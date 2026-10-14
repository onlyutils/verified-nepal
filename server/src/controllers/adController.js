import { AD_SLOTS, AD_TARGET_KINDS } from "../constants.js";
import { json, err, getQuery, parseBody } from "../lib/http.js";
import { validateString, validateDistrict, validateArticleUrl } from "../lib/validate.js";
import { getMunicipality } from "../lib/adminUnits.js";
import { createAd, updateAd, deleteAd, listAds, pickAd } from "../models/ad.js";
import { recordAudit } from "../models/audit.js";
import { toPublicAd, toAdminAd } from "../views/ad.js";

const MAX_BODY_BYTES = 16 * 1024;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

function validateSlot(slot) {
  if (!AD_SLOTS.includes(slot)) throw err(400, "invalid slot");
  return slot;
}

function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw err(400, `${name} must be an object`);
  return value;
}

function limitedBody(event) {
  let raw = event.body;
  if (event.isBase64Encoded && typeof raw === "string") {
    if (raw.length > Math.ceil(MAX_BODY_BYTES / 3) * 4) throw err(413, "body too large");
    raw = Buffer.from(raw, "base64");
  }
  const size = typeof raw === "string" ? Buffer.byteLength(raw)
    : raw instanceof Uint8Array ? raw.byteLength
    : Buffer.byteLength(JSON.stringify(raw ?? null));
  if (size > MAX_BODY_BYTES) throw err(413, "body too large");
  return requireObject(parseBody({ body: raw }), "body");
}

function httpsUrl(value, name, max) {
  const url = validateString(value, name, 1, max);
  try {
    const parsed = new URL(url);
    if (!/^https:\/\//.test(url) || /[\s\\]/.test(url) || parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password)
      throw new Error();
  } catch {
    throw err(400, `${name} must be an https URL`);
  }
  return url;
}

function isoDate(value, name) {
  const text = validateString(value, name, 1, 50);
  const pattern = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
  if (!pattern.test(text) || !Number.isFinite(Date.parse(text))) throw err(400, `${name} must be an ISO date`);
  // Date.parse rolls February 30 into March; reject a non-existent calendar day.
  const date = text.slice(0, 10);
  if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw err(400, `${name} must be an ISO date`);
  return new Date(text).toISOString();
}

function plainLabel(value, name) {
  const text = validateString(value, name, 1, 60);
  if (/[<>]/.test(text)) throw err(400, `${name} must be plain text`);
  return text;
}

function validateAdBody(event, env) {
  const body = limitedBody(event);
  const slot = validateSlot(body.slot);
  const rawTarget = requireObject(body.target, "target");
  if (!AD_TARGET_KINDS.includes(rawTarget.kind)) throw err(400, "invalid target.kind");
  const target = { kind: rawTarget.kind };
  if (target.kind === "district") target.value = validateDistrict(rawTarget.value, "target.value");
  if (target.kind === "municipality") {
    if (!["string", "number"].includes(typeof rawTarget.value)) throw err(400, "target.value must be a municipality");
    const municipality = getMunicipality(rawTarget.value);
    if (!municipality) throw err(400, "target.value must be a municipality");
    target.value = municipality.id;
  }
  const rawImage = requireObject(body.image, "image");
  const image = {
    url: httpsUrl(validateArticleUrl(rawImage.url, "image.url", env?.MEDIA_PUBLIC_BASE), "image.url", 2000),
    fileId: validateString(rawImage.fileId, "image.fileId", 1, 200),
  };
  const href = httpsUrl(body.href, "href", 500);
  const rawLabel = requireObject(body.label, "label");
  const label = { en: plainLabel(rawLabel.en, "label.en"), ne: plainLabel(rawLabel.ne, "label.ne") };
  const startAt = isoDate(body.startAt, "startAt");
  const endAt = isoDate(body.endAt, "endAt");
  if (startAt >= endAt) throw err(400, "startAt must precede endAt");
  const note = body.note === undefined ? "" : validateString(body.note, "note", 0, 500);
  return { slot, target, image, href, label, startAt, endAt, note };
}

async function auditAd(auth, action, ad) {
  await recordAudit(auth.ddb, auth.tableName, {
    actorSub: auth.payload.sub,
    actorName: auth.user?.name || auth.payload.name || "",
    action,
    targetType: "AD",
    targetId: ad.id,
    targetLabel: ad.label.en,
  });
}

export async function handleGetAd(event, { getDdb, env }) {
  const q = getQuery(event);
  // An omitted slot selects nothing; explicit unknown slots remain validation errors.
  const slot = q.slot === undefined || q.slot === null ? undefined : validateSlot(q.slot);
  let ad = null;
  if (slot) {
    if (!env.TABLE_NAME) throw err(500, "TABLE_NAME not configured");
    const ads = await listAds(getDdb(), env.TABLE_NAME, { slot });
    ad = pickAd(ads, {
      slot,
      district: typeof q.district === "string" ? q.district.trim() : undefined,
      municipalityId: typeof q.municipality === "string" ? getMunicipality(q.municipality)?.id : undefined,
    }, new Date().toISOString());
  }
  const response = json(200, { ad: toPublicAd(ad) });
  response.headers["cache-control"] = "public, max-age=300";
  return response;
}

export async function handleAdminAdsList(event, { auth }) {
  if (auth.role !== "admin") throw err(403, "Forbidden");
  const slots = await Promise.all(AD_SLOTS.map((slot) => listAds(auth.ddb, auth.tableName, { slot })));
  const nowIso = new Date().toISOString();
  return json(200, { items: slots.flat().map((ad) => toAdminAd(ad, nowIso)) });
}

export async function handleAdminAdCreate(event, { auth, env }) {
  if (auth.role !== "admin") throw err(403, "Forbidden");
  const fields = validateAdBody(event, env);
  const ad = await createAd(auth.ddb, auth.tableName, { ...fields, createdBy: auth.payload.sub });
  await auditAd(auth, "ad.create", ad);
  return json(201, toAdminAd(ad, new Date().toISOString()));
}

export async function handleAdminAdUpdate(event, { auth, env }, id) {
  if (auth.role !== "admin") throw err(403, "Forbidden");
  if (!ID.test(id)) throw err(400, "invalid id");
  const fields = validateAdBody(event, env);
  const ad = await updateAd(auth.ddb, auth.tableName, id, fields);
  await auditAd(auth, "ad.update", ad);
  return json(200, toAdminAd(ad, new Date().toISOString()));
}

export async function handleAdminAdDelete(event, { auth }, id) {
  if (auth.role !== "admin") throw err(403, "Forbidden");
  if (!ID.test(id)) throw err(400, "invalid id");
  const ad = await deleteAd(auth.ddb, auth.tableName, id);
  await auditAd(auth, "ad.delete", ad);
  return json(200, { ok: true });
}
