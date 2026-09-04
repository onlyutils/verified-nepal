import { randomUUID } from "node:crypto";
import { json, err, getQuery, parseBody, encodeCursor, decodeCursor, stripInternal } from "../lib/http.js";
import { requireAuth, requireModAuth, ensureGuidelinesAck } from "../lib/auth.js";
import { validateString, validateArticleUrl } from "../lib/validate.js";
import { listPointers } from "../models/mine.js";
import { recordAudit } from "../models/audit.js";
import { storyRole, createStory, getStory, deleteStory, listStoriesByStatus, moderateStory } from "../models/story.js";

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const STORY_LIMIT = 24;

function toPublicStory(s) {
  return { id: s.id, media: s.media, caption: s.caption, role: s.role, author: { displayName: s.author?.displayName || "" }, publishedAt: s.publishedAt };
}
function toMyStory(s) {
  const out = { ...toPublicStory(s), status: s.status, createdAt: s.createdAt };
  if (s.rejectReason) out.rejectReason = s.rejectReason;
  return out;
}

/** A story is one photo or video plus a short caption, from someone who received or gave help. */
export async function handlePostStory(event, opts) {
  const auth = await requireAuth(event, opts);
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const caption = validateString(body.caption, "caption", 1, 500);
  const media = body.media;
  if (!media || typeof media !== "object" || !["photo", "video"].includes(media.type)) throw err(400, 'media.type must be "photo" or "video"');
  const cleanMedia = {
    type: media.type,
    fileId: validateString(media.fileId, "media.fileId", 1, 300),
    url: validateArticleUrl(media.url, "media.url", (opts.env || {}).MEDIA_PUBLIC_BASE),
  };
  const role = await storyRole(auth.ddb, auth.tableName, auth.payload.sub);
  if (!role) return json(403, { error: "story_not_eligible" });
  const id = randomUUID();
  const now = new Date().toISOString();
  await createStory(auth.ddb, auth.tableName, {
    PK: `STORY#${id}`, SK: "META", type: "STORY", id, authorSub: auth.payload.sub,
    author: { displayName: auth.user?.name || auth.payload.name || "", email: auth.payload.email || "" },
    role, media: cleanMedia, caption, status: "pending", createdAt: now, gsi2pk: "STORY#pending", gsi2sk: now,
  });
  return json(201, { id });
}

export async function handleGetMyStories(event, opts) {
  const auth = await requireAuth(event, opts);
  const items = [];
  for (const p of (await listPointers(auth.ddb, auth.tableName, auth.payload.sub)).filter((p) => p.kind === "STORY")) {
    const s = await getStory(auth.ddb, auth.tableName, p.id);
    if (s && s.authorSub === auth.payload.sub) items.push(toMyStory(s));
  }
  return json(200, { items });
}

export async function handleDeleteStory(event, opts, id) {
  const auth = await requireAuth(event, opts);
  if (!ID.test(id)) throw err(400, "invalid id");
  const s = await getStory(auth.ddb, auth.tableName, id);
  if (!s) throw err(404, "not found");
  if (s.authorSub !== auth.payload.sub) throw err(403, "forbidden");
  await deleteStory(auth.ddb, auth.tableName, s);
  return { statusCode: 204, headers: {}, body: "" };
}

export async function handleGetStories(event, { getDdb, env }) {
  if (!env.TABLE_NAME) throw err(500, "TABLE_NAME not configured");
  const q = getQuery(event);
  const { items, lastEvaluatedKey } = await listStoriesByStatus(getDdb(), env.TABLE_NAME, "published", {
    newestFirst: true, limit: STORY_LIMIT, cursorKey: decodeCursor(q.cursor ? String(q.cursor) : ""),
  });
  const body = { items: items.map(toPublicStory) };
  if (lastEvaluatedKey) body.cursor = encodeCursor(lastEvaluatedKey);
  return { statusCode: 200, headers: { "content-type": "application/json", "cache-control": "public, max-age=60" }, body: JSON.stringify(body) };
}

export async function handleGetModerationStories(event, opts) {
  const auth = await requireModAuth(event, opts); ensureGuidelinesAck(auth);
  const { items } = await listStoriesByStatus(auth.ddb, auth.tableName, "pending");
  return json(200, { items: items.map(stripInternal) });
}

export async function handlePostModerationStory(event, opts, id) {
  const auth = await requireModAuth(event, opts); ensureGuidelinesAck(auth);
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { action } = body;
  if (!["publish", "reject"].includes(action)) throw err(400, 'action must be "publish" or "reject"');
  const reason = body.reason === undefined || body.reason === null ? undefined : validateString(body.reason, "reason", 1, 500);
  if (!ID.test(id)) throw err(400, "invalid id");
  const s = await getStory(auth.ddb, auth.tableName, id);
  if (!s || s.status !== "pending") throw err(404, "not found");
  await moderateStory(auth.ddb, auth.tableName, s, { action, reason });
  await recordAudit(auth.ddb, auth.tableName, {
    actorSub: auth.payload.sub, actorName: auth.user?.name || auth.payload.name || "",
    action, targetType: "STORY", targetId: id, targetLabel: s.caption.slice(0, 80), reason,
  });
  return json(200, { status: s.status });
}
