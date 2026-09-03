import { json, err, getQuery, parseBody, encodeCursor, decodeCursor } from "../lib/http.js";
import { validateString, validatePhone, validateOptionalEmail, validateDistrict } from "../lib/validate.js";
import { maskName } from "../lib/format.js";
import { verifyTurnstile } from "../lib/turnstile.js";
import { requireAuth, optionalAuth, ensureGuidelinesAck, isOutOfScope } from "../lib/auth.js";
import {
  CATEGORIES, LANGUAGES, FLAG_REASONS, MOD_STATUS,
  ALLOWED_PHOTO_TYPES, ALLOWED_VIDEO_TYPES, MAX_PHOTO_SIZE, MAX_VIDEO_SIZE, MAX_NEED_MEDIA_ITEMS,
} from "../constants.js";
import { requestPresign } from "../models/media.js";
import {
  createNeed, listPublicNeeds, getRefPointer, getNeedById, renewNeed,
  setNeedStatus, getOfferById, addFlag, bumpFlagCount, upsertFlaggedPointer,
  listFlaggedPointers, listFlagsForNeed,
} from "../models/need.js";
import { recordAudit, getTargetLabelForAudit } from "../models/audit.js";
import { putPointer } from "../models/mine.js";
import { toPublicNeedListItem, toStatusView, toFlagListItem } from "../views/need.js";

function validateNeedMedia(media) {
  if (media === undefined || media === null) return undefined;
  if (!Array.isArray(media)) throw err(400, "media must be an array");
  if (media.length > MAX_NEED_MEDIA_ITEMS) throw err(400, `media must have at most ${MAX_NEED_MEDIA_ITEMS} items`);
  return media.map((item, i) => {
    if (!item || typeof item !== "object") throw err(400, `media[${i}] must be an object`);
    if (!["photo", "video"].includes(item.type)) throw err(400, `media[${i}].type must be "photo" or "video"`);
    const fileId = validateString(item.fileId, `media[${i}].fileId`, 1, 300);
    const originalUrl = validateString(item.originalUrl, `media[${i}].originalUrl`, 1, 2000);
    const out = { fileId, type: item.type, originalUrl };
    // Reserved for the OnlyUtils media-variants requirement (docs/onlyutils-media-variants-requirement.md);
    // no caller populates these yet, but accepting them now avoids a schema migration later.
    if (item.smallUrl !== undefined) out.smallUrl = validateString(item.smallUrl, `media[${i}].smallUrl`, 1, 2000);
    if (item.compressedUrl !== undefined) out.compressedUrl = validateString(item.compressedUrl, `media[${i}].compressedUrl`, 1, 2000);
    return out;
  });
}

export async function handlePostNeeds(event, { getDdb, env, fetchJwks }) {
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { onBehalf, registrant, beneficiary, category, description, language, turnstileToken, media } = body;
  if (typeof onBehalf !== "boolean") throw err(400, "onBehalf must be boolean");
  let regName, regPhone, regEmail;
  if (onBehalf) {
    if (!registrant || typeof registrant !== "object") throw err(400, "registrant required when onBehalf is true");
    regName = validateString(registrant.name, "registrant.name", 1, 100);
    regPhone = validatePhone(registrant.phone, "registrant.phone");
    regEmail = validateOptionalEmail(registrant.email, "registrant.email");
  } else if (registrant !== undefined && registrant !== null) {
    if (typeof registrant !== "object") throw err(400, "registrant must be object");
    if (registrant.name !== undefined) regName = validateString(registrant.name, "registrant.name", 1, 100);
    if (registrant.phone !== undefined) regPhone = validatePhone(registrant.phone, "registrant.phone");
    regEmail = validateOptionalEmail(registrant.email, "registrant.email");
  }
  if (!beneficiary || typeof beneficiary !== "object") throw err(400, "beneficiary required");
  const benName = validateString(beneficiary.name, "beneficiary.name", 1, 100);
  let benPhone;
  if (beneficiary.phone !== undefined && beneficiary.phone !== null && String(beneficiary.phone).trim() !== "") {
    benPhone = validatePhone(beneficiary.phone, "beneficiary.phone");
  }
  const benEmail = validateOptionalEmail(beneficiary.email, "beneficiary.email");
  const district = validateDistrict(beneficiary.district, "beneficiary.district");
  const ward = beneficiary.ward;
  if (typeof ward !== "number" || !Number.isInteger(ward) || ward < 1 || ward > 33) throw err(400, "beneficiary.ward must be integer 1-33");
  let householdSize;
  if (beneficiary.householdSize !== undefined && beneficiary.householdSize !== null) {
    if (typeof beneficiary.householdSize !== "number" || !Number.isInteger(beneficiary.householdSize) || beneficiary.householdSize < 1 || beneficiary.householdSize > 30) throw err(400, "beneficiary.householdSize must be integer 1-30");
    householdSize = beneficiary.householdSize;
  }
  if (!CATEGORIES.includes(category)) throw err(400, `category must be one of ${CATEGORIES.join(",")}`);
  const desc = validateString(description, "description", 10, 2000);
  if (!LANGUAGES.includes(language)) throw err(400, 'language must be "en" or "ne"');
  const cleanMedia = validateNeedMedia(media);
  await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET, { required: env.REQUIRE_TURNSTILE === "1" });
  const auth = await optionalAuth(event, { fetchJwks, getDdb, env });
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  const { id, refCode } = await createNeed(ddb, tableName, {
    onBehalf, regName, regPhone, regEmail, benName, benPhone, benEmail,
    district, ward, householdSize, category, description: desc, language, media: cleanMedia,
  });
  if (auth) await putPointer(ddb, tableName, { sub: auth.payload.sub, type: "NEED", id });
  return json(201, { id, refCode });
}

export async function handlePostNeedsMediaPresign(event, { env, fetchImpl }) {
  if (!env.OU_MEDIA_CLIENT_ID || !env.OU_MEDIA_CLIENT_SECRET) {
    return json(503, { error: "media_not_configured" });
  }
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const filename = validateString(body.filename, "filename", 1, 255);
  const photo = ALLOWED_PHOTO_TYPES.includes(body.contentType);
  const video = ALLOWED_VIDEO_TYPES.includes(body.contentType);
  if (!photo && !video) {
    throw err(400, `contentType must be one of ${[...ALLOWED_PHOTO_TYPES, ...ALLOWED_VIDEO_TYPES].join(",")}`);
  }
  const maxSize = photo ? MAX_PHOTO_SIZE : MAX_VIDEO_SIZE;
  if (typeof body.size !== "number" || !Number.isFinite(body.size) || body.size <= 0 || body.size > maxSize) {
    throw err(400, `size must be 1-${maxSize}`);
  }
  await verifyTurnstile(body.turnstileToken, env.TURNSTILE_SECRET, { required: env.REQUIRE_TURNSTILE === "1" });
  try {
    const presign = await requestPresign(env, fetchImpl, { filename, contentType: body.contentType });
    return json(200, { ...presign, mediaType: photo ? "photo" : "video" });
  } catch (e) {
    if (e.status === 503 || e.code === "media_not_configured") return json(503, { error: "media_not_configured" });
    return json(502, { error: e.code || "media_upstream", message: e.message || "media upstream error" });
  }
}

export async function handleGetNeeds(event, { getDdb, env }) {
  const q = getQuery(event);
  const district = q.district ? String(q.district).trim() : "";
  const category = q.category ? String(q.category).trim() : "";
  const cursorRaw = q.cursor ? String(q.cursor) : "";
  if (category && !CATEGORIES.includes(category)) throw err(400, `category must be one of ${CATEGORIES.join(",")}`);
  const cursorKey = decodeCursor(cursorRaw);
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  const items = await listPublicNeeds(ddb, tableName, { district, category });
  let start = 0;
  if (cursorKey) {
    const idx = items.findIndex((it) => it.PK === cursorKey.PK && it.SK === cursorKey.SK);
    if (idx === -1) throw err(400, "invalid cursor");
    start = idx + 1;
  }
  const limit = 20;
  const sliced = items.slice(start, start + limit);
  const publicItems = sliced.map(toPublicNeedListItem);
  const body = { items: publicItems };
  if (start + limit < items.length) {
    const last = sliced[sliced.length - 1];
    body.cursor = encodeCursor({ PK: last.PK, SK: last.SK });
  }
  return json(200, body);
}

export async function handleGetStatus(event, { getDdb, env }, refCode) {
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  const ref = await getRefPointer(ddb, tableName, refCode);
  if (!ref) throw err(404, "not found");
  const need = await getNeedById(ddb, tableName, ref.needId);
  if (!need) throw err(404, "not found");
  return json(200, toStatusView(need));
}

export async function handlePostRenew(event, { getDdb, env }, refCode) {
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  const ref = await getRefPointer(ddb, tableName, refCode);
  if (!ref) throw err(404, "not found");
  const need = await getNeedById(ddb, tableName, ref.needId);
  if (!need) throw err(404, "not found");
  const expiresAt = await renewNeed(ddb, tableName, { ref, need });
  return json(200, { expiresAt });
}

export async function handlePostNeedStatus(event, opts, needId) {
  const auth = await requireAuth(event, opts);
  if (!["moderator", "admin"].includes(auth.role)) throw err(403, "Forbidden");
  ensureGuidelinesAck(auth);
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { status, offerId } = body;
  if (!MOD_STATUS.includes(status)) throw err(400, `status must be one of ${MOD_STATUS.join(",")}`);
  if (offerId !== undefined && offerId !== null) {
    if (typeof offerId !== "string" || !offerId.trim() || offerId.trim().length > 200) throw err(400, "offerId must be a string up to 200 chars");
  }
  const tableName = auth.tableName;
  const ddb = auth.ddb;
  const need = await getNeedById(ddb, tableName, needId);
  if (!need) throw err(404, "not found");
  if (isOutOfScope(auth.user, need)) throw err(403, "out_of_scope");
  if (need.status === "pending" || need.status === "rejected") throw err(400, "need must be published before status update");
  await setNeedStatus(ddb, tableName, { need, status, offerId });
  const actorName2 = auth.user?.name || auth.payload.name || "";
  const targetLabel2 = getTargetLabelForAudit("NEED", need);
  await recordAudit(ddb, tableName, { actorSub: auth.payload.sub, actorName: actorName2, action: `status:${status}`, targetType: "NEED", targetId: needId, targetLabel: targetLabel2 });
  if (status === "matched") {
    let offer = null;
    if (offerId) {
      offer = await getOfferById(ddb, tableName, offerId);
    }
    const contact = {
      beneficiary: {
        name: need.beneficiary?.name,
        phone: need.beneficiary?.phone || null,
        district: need.beneficiary?.district,
        ward: need.beneficiary?.ward,
      },
      registrant: need.registrant ? { name: need.registrant.name, phone: need.registrant.phone } : null,
      offer: offer ? { phone: offer.phone, helperLabel: offer.helperLabel, org: offer.org || null, categories: offer.categories, districts: offer.districts } : null,
    };
    return json(200, { status, contact });
  }
  return json(200, { status });
}

export async function handlePostFlag(event, { getDdb, env }, needId) {
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { reason, details, turnstileToken } = body;
  if (!FLAG_REASONS.includes(reason)) throw err(400, `reason must be one of ${FLAG_REASONS.join(",")}`);
  let cleanDetails;
  if (details !== undefined && details !== null) {
    if (typeof details !== "string") throw err(400, "details must be string");
    if (details.length > 500) throw err(400, "details too long");
    cleanDetails = details;
  }
  await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET, { required: env.REQUIRE_TURNSTILE === "1" });
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  const need = await getNeedById(ddb, tableName, needId);
  if (!need) throw err(404, "not found");
  await addFlag(ddb, tableName, { needId, reason, details: cleanDetails });
  const flagCount = await bumpFlagCount(ddb, tableName, need);
  const maskedName = maskName(need.beneficiary?.name || "");
  const district = need.beneficiary?.district || need.district || "";
  const ward = need.beneficiary?.ward ?? need.ward;
  await upsertFlaggedPointer(ddb, tableName, { needId, flagCount, maskedName, district, ward });
  return json(201, { ok: true });
}

export async function handleGetFlags(event, opts) {
  const auth = await requireAuth(event, opts);
  if (!["moderator", "admin"].includes(auth.role)) throw err(403, "Forbidden");
  ensureGuidelinesAck(auth);
  const tableName = auth.tableName;
  const ddb = auth.ddb;
  const pointers = await listFlaggedPointers(ddb, tableName);
  const out = [];
  for (const p of pointers) {
    const needId = p.needId || p.SK;
    const flags = await listFlagsForNeed(ddb, tableName, needId);
    out.push(toFlagListItem(p, flags));
  }
  let filtered = out;
  if (auth.role === "moderator" && Array.isArray(auth.user?.districts) && auth.user.districts.length > 0) {
    filtered = out.filter((it) => !isOutOfScope(auth.user, it.district));
  }
  filtered.sort((a, b) => b.flagCount - a.flagCount || a.maskedName.localeCompare(b.maskedName));
  return json(200, { items: filtered });
}
