import { randomUUID } from "node:crypto";
import { DeleteCommand, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { json, err, getQuery, parseBody, encodeCursor, decodeCursor, stripInternal } from "../lib/http.js";
import {
  validateArticleBlocks,
  validateArticleCover,
  validateArticleTags,
  validateArticleTitle,
  validateLocality,
  validateScope,
  validateHappenedAt,
  validateExpiresAt,
  validateSourceUrls,
  validateSourceNote,
} from "../lib/validate.js";
import {
  ALLOWED_ARTICLE_MEDIA_TYPES,
  DISPATCH_TAGS,
  LANGUAGES,
  MAX_ARTICLE_IMAGE_SIZE,
  MAX_ARTICLE_VIDEO_SIZE,
  DISPATCH_KINDS,
  NEWS_BODY_MAX,
  NEWS_SCOPES,
} from "../constants.js";
import { deletePointer, listPointers, putPointer } from "../models/mine.js";
import { requestPresign } from "../models/media.js";
import {
  queryPublishedDispatchesPage,
  getDispatchById,
  listPendingDispatches,
  moderateDispatch,
  dispatchKind,
} from "../models/dispatch.js";
import { toPublicDispatchListItem, toPublicDispatchDetail, localDispatchFields } from "../views/dispatch.js";
import { getLocalUpdateSettings } from "../models/localUpdateSettings.js";
import { pingIndexNow } from "../lib/indexnow.js";

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const envOf = (opts) => opts.env || {};

function currentTitle(item) {
  if (typeof item.title === "string") return item.title;
  return item.title?.[item.language] ?? item.title?.en ?? item.title?.ne ?? "";
}

function strictTitle(item) {
  if (typeof item.title === "string") return item.title;
  return item.title?.[item.language] ?? "";
}

function articleListView(item) {
  const out = {
    ...localDispatchFields(item),
    id: item.id,
    status: item.status,
    title: currentTitle(item),
    language: item.language,
    tags: item.tags || [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt || item.createdAt,
    views: Number(item.views) || 0,
    likes: Number(item.likes) || 0,
    shares: Number(item.shares) || 0,
  };
  if (item.cover) out.cover = item.cover;
  for (const key of ["submittedAt", "publishedAt", "rejectReason"]) if (item[key] !== undefined) out[key] = item[key];
  return out;
}

function articleDetailView(item) {
  const out = {
    ...articleListView(item),
    blocks: Array.isArray(item.blocks) ? item.blocks : [],
    displayName: item.author?.displayName || "",
  };
  if (item.author?.place) out.place = item.author.place;
  return out;
}

async function getOwnedArticle(auth, id) {
  if (!ID.test(id)) throw err(400, "invalid id");
  const res = await auth.ddb.send(new GetCommand({ TableName: auth.tableName, Key: { PK: `DISPATCH#${id}`, SK: "META" } }));
  if (!res.Item) throw err(404, "not found");
  if (res.Item.authorSub !== auth.payload.sub) throw err(403, "forbidden");
  return res.Item;
}

function normalizeTitleObject(item, language, title) {
  const existing = item.title && typeof item.title === "object" ? item.title : {};
  return { ...existing, [language]: title };
}

function applyAuthorFields(item, body, opts) {
  const language = body.language === undefined ? item.language : body.language;
  if (!LANGUAGES.includes(language)) throw err(400, 'language must be "en" or "ne"');
  if (body.title !== undefined) item.title = normalizeTitleObject(item, language, validateArticleTitle(body.title));
  if (dispatchKind(item) === "news" && body.body !== undefined && body.blocks === undefined) {
    const text = typeof body.body === "string" ? body.body : body.body?.[language];
    if (typeof text !== "string") throw err(400, "body must be text in the selected language");
    body = { ...body, blocks: [{ type: "paragraph", text }] };
  }
  if (body.blocks !== undefined) item.blocks = validateArticleBlocks(body.blocks, { mediaPublicBase: envOf(opts).MEDIA_PUBLIC_BASE });
  if (body.cover !== undefined) {
    if (body.cover === null) delete item.cover;
    else item.cover = validateArticleCover(body.cover, { mediaPublicBase: envOf(opts).MEDIA_PUBLIC_BASE });
  }
  if (body.tags !== undefined) item.tags = validateArticleTags(body.tags);
  if (body.displayName !== undefined) {
    if (typeof body.displayName !== "string" || body.displayName.length > 100) throw err(400, "displayName must be at most 100 characters");
    item.author.displayName = body.displayName.trim();
  }
  if (body.place !== undefined) {
    if (typeof body.place !== "string" || body.place.length > 100) throw err(400, "place must be at most 100 characters");
    if (body.place.trim()) item.author.place = body.place.trim();
    else delete item.author.place;
  }
  if (body.kind !== undefined && body.kind !== dispatchKind(item)) throw err(400, "kind cannot be changed");
  if (body.locality !== undefined) {
    const locality = validateLocality(body.locality, { required: false });
    if (locality) item.locality = locality;
    else delete item.locality;
  }
  if (body.scope !== undefined) item.scope = validateScope(body.scope);
  if (body.happenedAt !== undefined) item.happenedAt = validateHappenedAt(body.happenedAt);
  if (body.expiresAt !== undefined) {
    if (body.expiresAt === null) delete item.expiresAt;
    else item.expiresAt = validateExpiresAt(body.expiresAt);
  }
  if (body.sourceUrls !== undefined) item.sourceUrls = validateSourceUrls(body.sourceUrls);
  if (body.sourceNote !== undefined) {
    const sourceNote = validateSourceNote(body.sourceNote);
    if (sourceNote) item.sourceNote = sourceNote;
    else delete item.sourceNote;
  }
  item.language = language;
  item.body = {
    ...(item.body || {}),
    [language]: (item.blocks || [])
      .filter((block) => block.type === "paragraph")
      .map((block) => block.text || "")
      .join("\n\n"),
  };
}

function strictMissingNews(item) {
  const missing = [];
  const title = strictTitle(item);
  if (typeof title !== "string" || !title.trim() || title.trim().length > 200) missing.push("title");
  const blocks = Array.isArray(item.blocks) ? item.blocks : [];
  const text = blocks
    .filter((b) => b?.type === "paragraph")
    .map((b) => (typeof b.text === "string" ? b.text : ""))
    .join("\n\n");
  if (!text.trim() || text.length > NEWS_BODY_MAX) missing.push("body");
  if (blocks.some((b) => b?.type !== "paragraph" && b?.type !== "image")) missing.push("blocks");
  blocks.forEach((block, index) => {
    if (block?.type === "image" && (typeof block.source !== "string" || !block.source.trim())) missing.push(`block.source:${index}`);
  });
  if (!Array.isArray(item.tags) || item.tags.length !== 1 || !DISPATCH_TAGS.includes(item.tags[0])) missing.push("tags");
  if (!item.locality?.district) missing.push("locality");
  if (!NEWS_SCOPES.includes(item.scope)) missing.push("scope");
  if (!item.happenedAt) missing.push("happenedAt");
  if (!item.sourceUrls?.length && !item.sourceNote?.trim()) missing.push("source");
  return missing;
}

// ponytail: count ownership pointers as specified for Wave 1; use a transactional per-author counter if concurrent creates need a strict ceiling.
async function dailyLimitError(auth, nowIso) {
  if (auth.role === "admin") return null;
  const settings = await getLocalUpdateSettings(auth.ddb, auth.tableName);
  if (!settings.dailyLimitEnabled) return null;
  const now = Date.parse(nowIso);
  const times = [];
  for (const pointer of await listPointers(auth.ddb, auth.tableName, auth.payload.sub, { consistentRead: true })) {
    if (pointer.kind !== "ARTICLE") continue;
    const item = await getDispatchById(auth.ddb, auth.tableName, pointer.id, { consistentRead: true });
    const ts = Date.parse(item?.createdAt);
    if (item?.authorSub === auth.payload.sub && dispatchKind(item) === "news" && ts > now - 86400000 && ts <= now) times.push(ts);
  }
  if (times.length < settings.dailyLimit) return null;
  times.sort((a, b) => a - b);
  // If the admin lowered the limit, enough older creations must age out to fall below it.
  return json(429, {
    error: "daily_limit",
    limit: settings.dailyLimit,
    resetsAt: new Date(times[times.length - settings.dailyLimit] + 86400000).toISOString(),
  });
}

function strictMissing(item) {
  if (dispatchKind(item) === "news") return strictMissingNews(item);
  const missing = [];
  const title = strictTitle(item);
  if (typeof title !== "string" || !title.trim() || title.trim().length > 200) missing.push("title");
  const cover = item.cover;
  if (!cover || typeof cover !== "object" || !String(cover.url || "").trim() || !String(cover.fileId || "").trim()) missing.push("cover");
  else if (typeof cover.source !== "string" || !cover.source.trim()) missing.push("cover.source");
  const blocks = Array.isArray(item.blocks) ? item.blocks : [];
  if (!blocks.some((block) => block?.type === "paragraph" && typeof block.text === "string" && block.text.trim()))
    missing.push("paragraph");
  blocks.forEach((block, index) => {
    if ((block?.type === "image" || block?.type === "video") && (typeof block.source !== "string" || !block.source.trim()))
      missing.push(`block.source:${index}`);
  });
  if (!Array.isArray(item.tags) || item.tags.length < 1 || item.tags.length > 3 || item.tags.some((tag) => !DISPATCH_TAGS.includes(tag)))
    missing.push("tags");
  return missing;
}

export async function handlePostArticle(event, opts) {
  const { auth } = opts;
  const body = parseBody(event);
  if (!body || typeof body !== "object" || !LANGUAGES.includes(body.language)) throw err(400, 'language must be "en" or "ne"');
  const kind = body.kind === undefined ? "article" : body.kind;
  if (!DISPATCH_KINDS.includes(kind)) throw err(400, `kind must be one of ${DISPATCH_KINDS.join(",")}`);
  const reporter = auth.user?.reporter;
  if (kind === "news" && !reporter?.approvedAt && auth.role !== "admin") return json(403, { error: "reporter_required" });
  const id = randomUUID();
  const now = new Date().toISOString();
  const item = {
    PK: `DISPATCH#${id}`,
    SK: "META",
    type: "DISPATCH",
    id,
    kind,
    authorSub: auth.payload.sub,
    author: {
      displayName: typeof auth.payload.name === "string" ? auth.payload.name : "",
      email: typeof auth.payload.email === "string" ? auth.payload.email : "",
    },
    language: body.language,
    title: { [body.language]: "" },
    body: { [body.language]: "" },
    blocks: [],
    tags: [],
    status: "draft",
    gsi2pk: "DISPATCH#draft",
    gsi2sk: now,
    views: 0,
    likes: 0,
    shares: 0,
    createdAt: now,
    updatedAt: now,
  };
  if (kind === "news") {
    item.sourceUrls = [];
    const home = reporter?.localities?.[0];
    if (home) {
      item.locality = validateLocality(home);
      item.scope = home.ward ? "ward" : "municipality";
    }
    const paragraphs = Array.isArray(body.blocks)
      ? body.blocks
          .filter((block) => block?.type === "paragraph")
          .map((block) => (typeof block.text === "string" ? block.text : ""))
          .join("\n\n")
      : typeof body.body === "string"
        ? body.body
        : body.body?.[body.language];
    if (typeof paragraphs === "string" && paragraphs.length > NEWS_BODY_MAX) return json(400, { error: "invalid", missing: ["body"] });
    applyAuthorFields(item, body, opts);
    // Drafts may be incomplete, but creation always requires a date and a source.
    const missing = strictMissingNews(item).filter(
      (field) =>
        ["happenedAt", "source"].includes(field) ||
        ((body.blocks !== undefined || body.body !== undefined) &&
          (field === "body" || field === "blocks" || field.startsWith("block.source:"))) ||
        (body.tags !== undefined && field === "tags") ||
        (body.title !== undefined && field === "title"),
    );
    if (missing.length) return json(400, { error: "invalid", missing });
    const limited = await dailyLimitError(auth, now);
    if (limited) return limited;
  }
  await auth.ddb.send(new PutCommand({ TableName: auth.tableName, Item: item }));
  await putPointer(auth.ddb, auth.tableName, { sub: auth.payload.sub, type: "ARTICLE", id, createdAt: now });
  return json(201, { id });
}

export async function handleGetMyArticles(event, opts) {
  const { auth } = opts;
  const pointers = (await listPointers(auth.ddb, auth.tableName, auth.payload.sub)).filter((p) => p.kind === "ARTICLE");
  const items = [];
  for (const pointer of pointers) {
    const item = await getDispatchById(auth.ddb, auth.tableName, pointer.id);
    if (item && item.authorSub === auth.payload.sub) items.push(item);
  }
  items.sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""));
  return json(200, { items: items.map(articleListView) });
}

export async function handleGetMyArticle(event, opts, id) {
  const { auth } = opts;
  return json(200, articleDetailView(await getOwnedArticle(auth, id)));
}

export async function handlePutArticle(event, opts, id) {
  const { auth } = opts;
  const item = await getOwnedArticle(auth, id);
  if (!["draft", "rejected"].includes(item.status)) throw err(409, "article cannot be edited in its current status");
  const body = parseBody(event);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw err(400, "invalid body");
  applyAuthorFields(item, body, opts);
  const now = new Date().toISOString();
  item.updatedAt = now;
  item.gsi2sk = now;
  await auth.ddb.send(new PutCommand({ TableName: auth.tableName, Item: item }));
  return json(200, { updatedAt: now });
}

export async function handleSubmitArticle(event, opts, id) {
  const { auth } = opts;
  const item = await getOwnedArticle(auth, id);
  if (!["draft", "rejected"].includes(item.status)) throw err(409, "article cannot be submitted in its current status");
  const missing = strictMissing(item);
  if (missing.length) return json(400, { error: "invalid", missing });
  const now = new Date().toISOString();
  item.status = "pending";
  item.submittedAt = now;
  item.gsi2pk = "DISPATCH#pending";
  item.gsi2sk = now;
  item.updatedAt = now;
  delete item.rejectReason;
  await auth.ddb.send(new PutCommand({ TableName: auth.tableName, Item: item }));
  return json(200, { status: "pending" });
}

export async function handleDeleteArticle(event, opts, id) {
  const { auth } = opts;
  const item = await getOwnedArticle(auth, id);
  if (!["draft", "rejected", "pending"].includes(item.status)) throw err(409, "article cannot be deleted in its current status");
  await auth.ddb.send(new DeleteCommand({ TableName: auth.tableName, Key: { PK: item.PK, SK: item.SK } }));
  await deletePointer(auth.ddb, auth.tableName, { sub: auth.payload.sub, type: "ARTICLE", id });
  return { statusCode: 204, headers: {}, body: "" };
}

export async function handlePostArticlePresign(event, opts) {
  const env = envOf(opts);
  if (!env.OU_MEDIA_CLIENT_ID || !env.OU_MEDIA_CLIENT_SECRET) return json(503, { error: "media_not_configured" });
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  if (typeof body.filename !== "string" || !body.filename.trim() || body.filename.length > 255)
    throw err(400, "filename must be 1-255 characters");
  if (!ALLOWED_ARTICLE_MEDIA_TYPES.includes(body.contentType))
    throw err(400, "contentType must be one of image/jpeg,image/png,image/webp,video/mp4,video/webm");
  const max = body.contentType.startsWith("video/") ? MAX_ARTICLE_VIDEO_SIZE : MAX_ARTICLE_IMAGE_SIZE;
  if (typeof body.size !== "number" || !Number.isFinite(body.size) || body.size <= 0 || body.size > max)
    throw err(400, `size must be 1-${max}`);
  try {
    return json(200, await requestPresign(env, opts.fetchImpl, { filename: body.filename.trim(), contentType: body.contentType }));
  } catch (e) {
    if (e.status === 503 || e.code === "media_not_configured") return json(503, { error: "media_not_configured" });
    return json(502, { error: e.code || "media_upstream", message: e.message || "media upstream error" });
  }
}

async function requirePublished(ddb, tableName, id) {
  const item = await getDispatchById(ddb, tableName, id);
  if (!item || item.status !== "published") throw err(404, "not found");
  return item;
}

async function addCounter(ddb, tableName, id, field, delta) {
  const item = await requirePublished(ddb, tableName, id);
  const current = Math.max(0, Number(item[field]) || 0);
  if (delta < 0 && current <= 0) return current;
  const result = await ddb.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK: `DISPATCH#${id}`, SK: "META" },
      UpdateExpression: "ADD #counter :delta",
      ConditionExpression: "attribute_exists(PK) AND #status = :published",
      ExpressionAttributeNames: { "#counter": field, "#status": "status" },
      ExpressionAttributeValues: { ":delta": delta, ":published": "published" },
      ReturnValues: "ALL_NEW",
    }),
  );
  return Math.max(0, Number(result.Attributes?.[field]) || current + delta);
}

export async function handlePostArticleView(event, opts, id) {
  const tableName = envOf(opts).TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  await addCounter(opts.getDdb(), tableName, id, "views", 1);
  return { statusCode: 204, headers: {}, body: "" };
}

export async function handlePostArticleShare(event, opts, id) {
  const tableName = envOf(opts).TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  await addCounter(opts.getDdb(), tableName, id, "shares", 1);
  return { statusCode: 204, headers: {}, body: "" };
}

export async function handlePostArticleLike(event, opts, id) {
  const { auth } = opts;
  const ddb = auth?.ddb || opts.getDdb();
  const tableName = auth?.tableName || envOf(opts).TABLE_NAME;
  const item = await requirePublished(ddb, tableName, id);
  void item;
  if (auth) {
    const likeKey = { PK: `DISPATCH#${id}`, SK: `LIKE#${auth.payload.sub}` };
    const existing = await ddb.send(new GetCommand({ TableName: tableName, Key: likeKey }));
    let liked;
    let delta;
    if (existing.Item) {
      await ddb.send(new DeleteCommand({ TableName: tableName, Key: likeKey, ConditionExpression: "attribute_exists(PK)" }));
      liked = false;
      delta = -1;
    } else {
      await ddb.send(
        new PutCommand({
          TableName: tableName,
          Item: { ...likeKey, type: "LIKE", createdAt: new Date().toISOString() },
          ConditionExpression: "attribute_not_exists(PK)",
        }),
      );
      liked = true;
      delta = 1;
    }
    return json(200, { liked, likes: await addCounter(ddb, tableName, id, "likes", delta) });
  }
  const body = parseBody(event);
  if (body !== null && (typeof body !== "object" || Array.isArray(body))) throw err(400, "invalid body");
  if (body?.undo !== undefined && typeof body.undo !== "boolean") throw err(400, "undo must be boolean");
  return json(200, { likes: await addCounter(ddb, tableName, id, "likes", body?.undo ? -1 : 1) });
}

export async function handleGetDispatches(event, { getDdb, env }) {
  const q = getQuery(event);
  const tagRaw = q.tag ? String(q.tag).trim() : "";
  const cursorRaw = q.cursor ? String(q.cursor) : "";
  if (tagRaw && !DISPATCH_TAGS.includes(tagRaw)) throw err(400, `tag must be one of ${DISPATCH_TAGS.join(",")}`);
  if (!env.TABLE_NAME) throw err(500, "TABLE_NAME not configured");
  const kind = q.kind === undefined ? "article" : String(q.kind);
  if (!DISPATCH_KINDS.includes(kind)) throw err(400, `kind must be one of ${DISPATCH_KINDS.join(",")}`);
  const { sliced, hasMore, lastEvaluatedKey } = await queryPublishedDispatchesPage(getDdb(), env.TABLE_NAME, {
    tagRaw,
    kind,
    cursorKey: decodeCursor(cursorRaw),
  });
  const body = { items: sliced.map(toPublicDispatchListItem) };
  if (hasMore) {
    const last = lastEvaluatedKey || sliced[sliced.length - 1];
    if (last) body.cursor = encodeCursor(last);
  }
  return json(200, body);
}

export async function handleGetDispatch(event, { getDdb, env }, id) {
  if (!env.TABLE_NAME) throw err(500, "TABLE_NAME not configured");
  const item = await getDispatchById(getDdb(), env.TABLE_NAME, id);
  if (!item || item.status !== "published") throw err(404, "not found");
  return json(200, toPublicDispatchDetail(item));
}

export async function handleGetModerationDispatches(event, opts) {
  const { auth } = opts;
  const kind = getQuery(event).kind ?? "article";
  if (!DISPATCH_KINDS.includes(kind)) throw err(400, `kind must be one of ${DISPATCH_KINDS.join(",")}`);
  return json(200, {
    items: (await listPendingDispatches(auth.ddb, auth.tableName, { kind })).map((it) => ({
      ...stripInternal(it),
      ...localDispatchFields(it),
    })),
  });
}

export async function handlePostModerationDispatch(event, opts, id) {
  const { auth } = opts;
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { action, reason } = body;
  if (!["publish", "reject"].includes(action)) throw err(400, 'action must be "publish" or "reject"');
  if (action === "reject" && reason !== undefined && reason !== null && typeof reason !== "string") throw err(400, "reason must be string");
  const item = await getDispatchById(auth.ddb, auth.tableName, id);
  if (!item) throw err(404, "not found");
  if (item.status !== "pending") throw err(400, "only pending items can be moderated");
  if (dispatchKind(item) === "news" && item.authorSub === auth.payload.sub) throw err(403, "own_item");
  const actorName = auth.user?.name || auth.payload.name || "";
  const result = await moderateDispatch(auth.ddb, auth.tableName, { item, action, reason, actorSub: auth.payload.sub, actorName });
  if (action === "publish") await pingIndexNow([`/articles/${encodeURIComponent(id)}`], envOf(opts));
  return json(200, { status: result.status });
}
