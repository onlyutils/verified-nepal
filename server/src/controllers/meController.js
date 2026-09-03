import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { json, err, parseBody } from "../lib/http.js";
import { requireAuth } from "../lib/auth.js";
import { validateString, validateOptionalString, validateDistrict } from "../lib/validate.js";
import { ALLOWED_PHOTO_TYPES, LANGUAGES, MAX_PHOTO_SIZE } from "../constants.js";
import { getRefPointer } from "../models/need.js";
import { deletePointer, listPointers, putPointer } from "../models/mine.js";
import { requestPresign } from "../models/media.js";
import { deleteMissing, getMissingById, putMissing } from "../models/missing.js";
import { toMyMissing, toMyNeed, toMyOffer } from "../views/mine.js";

export async function handleGetDashboard(event, opts) {
  const auth = await requireAuth(event, opts);
  const { ddb, tableName, payload } = auth;
  const pointers = await listPointers(ddb, tableName, payload.sub);
  const out = { missing: [], needs: [], offers: [] };
  // A person owns tens of items, not thousands; one read per pointer keeps this simple.
  for (const p of pointers) {
    const res = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `${p.kind}#${p.id}`, SK: "META" } }));
    const item = res.Item;
    if (!item) continue;
    if (p.kind === "NEED") out.needs.push(toMyNeed(item));
    else if (p.kind === "OFFER") out.offers.push(toMyOffer(item));
    else if (p.kind === "MISSING") out.missing.push(toMyMissing(item));
  }
  return json(200, out);
}

export async function handlePostNeedClaim(event, opts) {
  const auth = await requireAuth(event, opts);
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const refCode = validateString(body.refCode, "refCode", 1, 32).toUpperCase();
  const ref = await getRefPointer(auth.ddb, auth.tableName, refCode);
  if (!ref || !ref.needId) throw err(404, "not found");
  await putPointer(auth.ddb, auth.tableName, { sub: auth.payload.sub, type: "NEED", id: ref.needId });
  return json(200, { ok: true, id: ref.needId });
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const PHONE = /^[0-9]{7,15}$/;
const ENUMS = {
  gender: ["", "woman", "man", "other"],
  status: ["missing", "found"],
  template: ["paper", "blue"],
  size: ["feed", "story"],
};

function validateMissingBody(body) {
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const out = {
    name: validateString(body.name, "name", 1, 60),
    nickname: validateOptionalString(body.nickname, "nickname", 0, 30) || "",
    age: validateOptionalString(body.age, "age", 0, 3) || "",
    district: validateDistrict(body.district),
    place: validateString(body.place, "place", 1, 60),
    lastSeenAt: validateOptionalString(body.lastSeenAt, "lastSeenAt", 0, 32) || "",
    clothing: validateOptionalString(body.clothing, "clothing", 0, 120) || "",
    story: validateOptionalString(body.story, "story", 0, 280) || "",
    language: body.language,
  };
  if (out.age && !/^\d{1,3}$/.test(out.age)) throw err(400, "age must be a number");
  if (out.age && Number(out.age) > 120) throw err(400, "age must be between 0 and 120");
  if (!LANGUAGES.includes(out.language)) throw err(400, 'language must be "en" or "ne"');
  for (const [key, allowed] of Object.entries(ENUMS)) {
    const value = body[key] ?? allowed[0];
    if (!allowed.includes(value)) throw err(400, `${key} must be one of ${allowed.join(",")}`);
    out[key] = value;
  }
  if (!Array.isArray(body.phones) || body.phones.length < 1 || body.phones.length > 2) {
    throw err(400, "phones must have 1-2 entries");
  }
  out.phones = body.phones.map((p) => String(p).replace(/[\s-]/g, ""));
  if (out.phones.some((p) => !PHONE.test(p))) throw err(400, "phones must be 7-15 digits");
  if (body.photo !== undefined && body.photo !== null) {
    if (typeof body.photo !== "object" || Array.isArray(body.photo)) throw err(400, "photo must be object");
    const fileId = validateString(body.photo.fileId, "photo.fileId", 1, 200);
    const url = validateString(body.photo.url, "photo.url", 8, 2000);
    if (!url.startsWith("https://")) throw err(400, "photo.url must be https");
    out.photo = { fileId, url };
  }
  return out;
}

export async function handlePutMissing(event, opts, id) {
  const auth = await requireAuth(event, opts);
  if (!ID.test(id)) throw err(400, "invalid id");
  const data = validateMissingBody(parseBody(event));
  const existing = await getMissingById(auth.ddb, auth.tableName, id);
  if (existing && existing.createdBy !== auth.payload.sub) throw err(403, "forbidden");
  const now = new Date().toISOString();
  const item = {
    ...data,
    PK: `MISSING#${id}`,
    SK: "META",
    type: "MISSING",
    id,
    createdBy: auth.payload.sub,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  if (!item.photo) delete item.photo;
  await putMissing(auth.ddb, auth.tableName, item);
  if (!existing) {
    await putPointer(auth.ddb, auth.tableName, {
      sub: auth.payload.sub,
      type: "MISSING",
      id,
      createdAt: now,
    });
  }
  return json(200, { id, updatedAt: now });
}

export async function handleDeleteMissing(event, opts, id) {
  const auth = await requireAuth(event, opts);
  if (!ID.test(id)) throw err(400, "invalid id");
  const existing = await getMissingById(auth.ddb, auth.tableName, id);
  if (!existing) throw err(404, "not found");
  if (existing.createdBy !== auth.payload.sub) throw err(403, "forbidden");
  await deleteMissing(auth.ddb, auth.tableName, id);
  await deletePointer(auth.ddb, auth.tableName, { sub: auth.payload.sub, type: "MISSING", id });
  return { statusCode: 204, headers: {}, body: "" };
}

export async function handlePostMissingPresign(event, opts) {
  const { env, fetchImpl } = opts;
  await requireAuth(event, opts);
  if (!env.OU_MEDIA_CLIENT_ID || !env.OU_MEDIA_CLIENT_SECRET) {
    return json(503, { error: "media_not_configured" });
  }
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const filename = validateString(body.filename, "filename", 1, 255);
  if (!ALLOWED_PHOTO_TYPES.includes(body.contentType)) {
    throw err(400, `contentType must be one of ${ALLOWED_PHOTO_TYPES.join(",")}`);
  }
  if (typeof body.size !== "number" || !Number.isFinite(body.size) || body.size <= 0 || body.size > MAX_PHOTO_SIZE) {
    throw err(400, `size must be 1-${MAX_PHOTO_SIZE}`);
  }
  try {
    return json(200, await requestPresign(env, fetchImpl, { filename, contentType: body.contentType }));
  } catch (e) {
    if (e.status === 503 || e.code === "media_not_configured") return json(503, { error: "media_not_configured" });
    return json(502, { error: e.code || "media_upstream", message: e.message || "media upstream error" });
  }
}
