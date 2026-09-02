import { json, err, getQuery, parseBody, encodeCursor, decodeCursor , stripInternal } from "../lib/http.js";
import { validateString, validateDispatchTitle, validateDispatchBody } from "../lib/validate.js";
import { verifyTurnstile } from "../lib/turnstile.js";
import { requireModAuth, ensureGuidelinesAck } from "../lib/auth.js";
import { LANGUAGES, DISPATCH_TAGS } from "../constants.js";
import {
  createDispatch, queryPublishedDispatchesPage, getDispatchById, listPendingDispatches, moderateDispatch,
} from "../models/dispatch.js";
import { toPublicDispatchListItem, toPublicDispatchDetail } from "../views/dispatch.js";

export async function handlePostDispatch(event, { getDdb, env }) {
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { title, body: bodyContent, author, tags, language, turnstileToken } = body;
  if (!LANGUAGES.includes(language)) throw err(400, 'language must be "en" or "ne"');
  await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET);
  let titleObj = validateDispatchTitle(title);
  if (titleObj.__single) {
    const val = titleObj.__single;
    titleObj = { [language]: val };
  }
  let bodyObj = validateDispatchBody(bodyContent);
  if (bodyObj.__single) {
    const val = bodyObj.__single;
    bodyObj = { [language]: val };
  }
  if (!author || typeof author !== "object") throw err(400, "author required");
  const displayName = validateString(author.displayName, "author.displayName", 1, 100);
  let place;
  if (author.place !== undefined && author.place !== null && String(author.place).trim() !== "") {
    place = validateString(author.place, "author.place", 1, 100);
  }
  const emailRaw = author.email;
  if (typeof emailRaw !== "string" || !emailRaw.trim()) throw err(400, "author.email required");
  const email = emailRaw.trim();
  if (email.length < 5 || email.length > 254) throw err(400, "author.email must be 5-254 characters");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw err(400, "author.email invalid");
  if (!Array.isArray(tags)) throw err(400, "tags must be array");
  if (tags.length === 0) throw err(400, "tags must be non-empty");
  if (tags.length > 3) throw err(400, "tags must be <=3");
  for (const t of tags) {
    if (!DISPATCH_TAGS.includes(t)) throw err(400, `tag must be one of ${DISPATCH_TAGS.join(",")}`);
  }
  const uniqueTags = Array.from(new Set(tags));
  if (uniqueTags.length !== tags.length) throw err(400, "tags must be unique");
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  const { id } = await createDispatch(ddb, tableName, { titleObj, bodyObj, displayName, place, email, uniqueTags, language });
  return json(201, { id });
}

export async function handleGetDispatches(event, { getDdb, env }) {
  const q = getQuery(event);
  const tagRaw = q.tag ? String(q.tag).trim() : "";
  const cursorRaw = q.cursor ? String(q.cursor) : "";
  if (tagRaw && !DISPATCH_TAGS.includes(tagRaw)) throw err(400, `tag must be one of ${DISPATCH_TAGS.join(",")}`);
  const cursorKey = decodeCursor(cursorRaw);
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  const { sliced, hasMore, lastEvaluatedKey } = await queryPublishedDispatchesPage(ddb, tableName, { tagRaw, cursorKey });
  const publicItems = sliced.map(toPublicDispatchListItem);
  const body = { items: publicItems };
  if (hasMore) {
    if (lastEvaluatedKey) {
      body.cursor = encodeCursor(lastEvaluatedKey);
    } else {
      const last = sliced[sliced.length - 1];
      body.cursor = encodeCursor({ PK: last.PK, SK: last.SK });
    }
  }
  return json(200, body);
}

export async function handleGetDispatch(event, { getDdb, env }, id) {
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  const item = await getDispatchById(ddb, tableName, id);
  if (!item) throw err(404, "not found");
  if (item.status !== "published") throw err(404, "not found");
  return json(200, toPublicDispatchDetail(item));
}

export async function handleGetModerationDispatches(event, opts) {
  const auth = await requireModAuth(event, opts);
  ensureGuidelinesAck(auth);
  const items = (await listPendingDispatches(auth.ddb, auth.tableName)).map(stripInternal);
  return json(200, { items });
}

export async function handlePostModerationDispatch(event, opts, id) {
  const auth = await requireModAuth(event, opts);
  ensureGuidelinesAck(auth);
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { action, reason } = body;
  if (!["publish", "reject"].includes(action)) throw err(400, 'action must be "publish" or "reject"');
  if (action === "reject") {
    if (reason !== undefined && reason !== null && typeof reason !== "string") throw err(400, "reason must be string");
  }
  const tableName = auth.tableName;
  const ddb = auth.ddb;
  const item = await getDispatchById(ddb, tableName, id);
  if (!item) throw err(404, "not found");
  if (item.status !== "pending") throw err(400, "only pending items can be moderated");
  const actorName = auth.user?.name || auth.payload.name || "";
  const result = await moderateDispatch(ddb, tableName, { item, action, reason, actorSub: auth.payload.sub, actorName });
  return json(200, { status: result.status });
}
