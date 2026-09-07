import { json, err, getQuery, parseBody, encodeCursor, decodeCursor } from "../lib/http.js";
import { validateString, validatePhone, validateOptionalEmail, validateDistrict, validateNeedMedia } from "../lib/validate.js";
import { maskName } from "../lib/format.js";
import { verifyTurnstile } from "../lib/turnstile.js";
import { requireAuth, isOutOfScope } from "../lib/auth.js";
import { getMunicipality, municipalityInDistrict, wardInMunicipality } from "../lib/adminUnits.js";
import {
  CATEGORIES, LANGUAGES, FLAG_REASONS, MOD_STATUS, GENERAL_INCIDENT_ID,
  ALLOWED_PHOTO_TYPES, ALLOWED_VIDEO_TYPES, MAX_PHOTO_SIZE, MAX_VIDEO_SIZE,
} from "../constants.js";
import { requestPresign } from "../models/media.js";
import { createIncident, getIncidentById } from "../models/incident.js";
import {
  createNeed, listPublicNeeds, getRefPointer, getNeedById, renewNeed,
  setNeedStatus, getOfferById, addFlag, bumpFlagCount, upsertFlaggedPointer,
  listFlaggedPointers, listFlagsForNeed,
} from "../models/need.js";
import { recordAudit, getTargetLabelForAudit } from "../models/audit.js";
import { tallyWork } from "../models/work.js";
import { putPointer } from "../models/mine.js";
import { applyModerationEdits } from "../models/moderation.js";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getDonation } from "../models/donation.js";
import { toPublicNeedListItem, toStatusView, toFlagListItem } from "../views/need.js";
import { expandKit, getKit } from "../lib/kits.js";

export async function handlePostNeeds(event, { getDdb, env, fetchJwks, auth: optionalAuthResult }) {
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { onBehalf, registrant, beneficiary, category, description, language, turnstileToken, media, incidentId, newIncident, assignOnly, consent, submissionId, kit: requestedKit } = body;
  const hasIncidentId = incidentId !== undefined && incidentId !== null && incidentId !== "";
  const hasNewIncident = newIncident !== undefined && newIncident !== null;
  if (hasIncidentId && hasNewIncident) throw err(400, "provide at most one of incidentId or newIncident");
  if (typeof onBehalf !== "boolean") throw err(400, "onBehalf must be boolean");
  if (assignOnly !== undefined && typeof assignOnly !== "boolean") throw err(400, "assignOnly must be boolean");
  if (submissionId !== undefined && (typeof submissionId !== "string" || submissionId.length < 8 || submissionId.length > 64 || !/^[A-Za-z0-9-]+$/.test(submissionId))) {
    throw err(400, "submissionId must be 8-64 alphanumeric characters or hyphens");
  }
  let auth = optionalAuthResult;
  if (onBehalf && !auth) throw err(401, "sign_in_required");
  if (onBehalf && consent !== true) throw err(400, "consent required");
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
  } else if (!onBehalf) {
    throw err(400, "beneficiary.phone required when onBehalf is false");
  }
  const benEmail = validateOptionalEmail(beneficiary.email, "beneficiary.email");
  const district = validateDistrict(beneficiary.district, "beneficiary.district");
  const municipalityId = beneficiary.municipalityId;
  if (typeof municipalityId !== "number" || !Number.isInteger(municipalityId)) throw err(400, "beneficiary.municipalityId must be an integer");
  if (!municipalityInDistrict(municipalityId, district)) throw err(400, "beneficiary.municipalityId: municipality is not in that district");
  const ward = beneficiary.ward;
  const muni = getMunicipality(municipalityId);
  if (typeof ward !== "number" || !Number.isInteger(ward) || !wardInMunicipality(municipalityId, ward)) throw err(400, `beneficiary.ward must be 1-${muni.wards} for ${muni.name}`);
  let householdSize;
  if (beneficiary.householdSize !== undefined && beneficiary.householdSize !== null) {
    if (typeof beneficiary.householdSize !== "number" || !Number.isInteger(beneficiary.householdSize) || beneficiary.householdSize < 1 || beneficiary.householdSize > 30) throw err(400, "beneficiary.householdSize must be integer 1-30");
    householdSize = beneficiary.householdSize;
  }
  if (!CATEGORIES.includes(category)) throw err(400, `category must be one of ${CATEGORIES.join(",")}`);
  const desc = validateString(description, "description", 10, 2000);
  if (!LANGUAGES.includes(language)) throw err(400, 'language must be "en" or "ne"');
  const cleanMedia = validateNeedMedia(media);
  let kit;
  let kitItems;
  let kitWeightKg;
  if (requestedKit !== undefined && requestedKit !== null) {
    if (typeof requestedKit !== "object" || Array.isArray(requestedKit)) throw err(400, "kit must be an object");
    const kitId = validateString(requestedKit.kitId, "kit.kitId", 1, 100);
    if (!getKit(kitId)) throw err(400, "kit.kitId is unknown");
    const households = requestedKit.households;
    if (!Number.isInteger(households) || households < 1 || households > 100000) throw err(400, "kit.households must be integer 1-100000");
    const expanded = expandKit(kitId, households);
    kit = { kitId, households };
    kitItems = expanded.items;
    kitWeightKg = expanded.weightKg;
  }
  if (!onBehalf) await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET, { required: env.REQUIRE_TURNSTILE === "1" });
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  let resolvedIncidentId;
  if (hasNewIncident) {
    auth = await requireAuth(event, { fetchJwks, getDdb, env });
    if (typeof newIncident !== "object" || Array.isArray(newIncident)) throw err(400, "newIncident must be object");
    const incidentName = validateString(newIncident.name, "newIncident.name", 2, 150);
    const incidentKind = validateString(newIncident.kind, "newIncident.kind", 1, 50);
    const incidentDistrict = validateDistrict(newIncident.district, "newIncident.district");
    const incidentDescription = validateString(newIncident.description, "newIncident.description", 10, 2000);
    if (!cleanMedia || !cleanMedia.some((item) => item.type === "photo")) throw err(400, "media must include at least one photo");
    const incident = await createIncident(ddb, tableName, {
      name: incidentName,
      kind: incidentKind,
      startedAt: new Date().toISOString().slice(0, 10),
      affectedDistricts: [incidentDistrict],
      summary: incidentDescription,
      status: "pending",
      requestOrigin: "community-request-inline",
      createdBy: auth.payload.sub,
    });
    resolvedIncidentId = incident.id;
  } else if (hasIncidentId) {
    if (typeof incidentId !== "string" || !incidentId.trim()) throw err(400, "invalid incident");
    const incident = await getIncidentById(ddb, tableName, incidentId.trim());
    if (!incident || !["active", "pending"].includes(incident.status)) throw err(400, "invalid incident");
    resolvedIncidentId = incident.id;
  } else {
    resolvedIncidentId = GENERAL_INCIDENT_ID;
  }
  const created = await createNeed(ddb, tableName, {
    onBehalf, regName, regPhone, regEmail, benName, benPhone, benEmail,
    incidentId: resolvedIncidentId, district, municipalityId, ward, householdSize, category, description: desc, language, media: cleanMedia,
    source: onBehalf ? "on-behalf" : (auth?.role === "moderator" || auth?.role === "admin") ? "staff" : "web",
    registeredByStaff: auth?.role === "moderator" || auth?.role === "admin",
    registrantSub: onBehalf ? auth.payload.sub : undefined,
    assignOnly, submissionId, kit, kitItems, kitWeightKg,
  });
  if (created.replayed) {
    const replay = json(200, { id: created.id, refCode: created.refCode });
    replay.headers["x-idempotent-replay"] = "1";
    return replay;
  }
  const { id, refCode } = created;
  if (auth) await putPointer(ddb, tableName, { sub: auth.payload.sub, type: "NEED", id });
  if (onBehalf) {
    try {
      await tallyWork(ddb, tableName, auth.payload.sub, "need.register", new Date().toISOString());
    } catch (e) {
      console.error("work tally failed", e);
    }
  }
  return json(201, { id, refCode });
}

export async function handlePostNeedsMediaPresign(event, { env, fetchImpl, auth }) {
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
  const requiresAuth = body.onBehalf === true || body.purpose === "receipt";
  if (requiresAuth && !auth) throw err(401, "sign_in_required");
  if (!requiresAuth) await verifyTurnstile(body.turnstileToken, env.TURNSTILE_SECRET, { required: env.REQUIRE_TURNSTILE === "1" });
  try {
    const presign = await requestPresign(env, fetchImpl, { filename, contentType: body.contentType });
    return json(200, { ...presign, mediaType: photo ? "photo" : "video" });
  } catch (e) {
    if (e.status === 503 || e.code === "media_not_configured") return json(503, { error: "media_not_configured" });
    return json(502, { error: e.code || "media_upstream", message: e.message || "media upstream error" });
  }
}

export async function handleGetNeeds(event, { getDdb, env, auth }) {
  const q = getQuery(event);
  const district = q.district ? String(q.district).trim() : "";
  const category = q.category ? String(q.category).trim() : "";
  const incidentId = q.incidentId ? String(q.incidentId).trim() : "";
  const cursorRaw = q.cursor ? String(q.cursor) : "";
  if (!incidentId) throw err(400, "incidentId required");
  if (category && !CATEGORIES.includes(category)) throw err(400, `category must be one of ${CATEGORIES.join(",")}`);
  const cursorKey = decodeCursor(cursorRaw);
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  const items = await listPublicNeeds(ddb, tableName, { incidentId, district, category });
  let start = 0;
  if (cursorKey) {
    const idx = items.findIndex((it) => it.PK === cursorKey.PK && it.SK === cursorKey.SK);
    if (idx === -1) throw err(400, "invalid cursor");
    start = idx + 1;
  }
  const limit = 20;
  const sliced = items.slice(start, start + limit);
  const includeClaimCode = Boolean(auth && ["moderator", "admin"].includes(auth.role) && (auth.role === "admin" || auth.user?.guidelinesAckAt));
  const publicItems = await Promise.all(sliced.map(async (item) => {
    const donation = item.donationRef ? await getDonation(ddb, tableName, item.donationRef) : undefined;
    return toPublicNeedListItem(item, { includeClaimCode, viewerSub: auth?.payload?.sub, donation });
  }));
  const body = { items: publicItems };
  if (start + limit < items.length) {
    const last = sliced[sliced.length - 1];
    body.cursor = encodeCursor({ PK: last.PK, SK: last.SK });
  }
  const response = json(200, body);
  response.headers["cache-control"] = "no-store";
  return response;
}

export async function handleGetStatus(event, { getDdb, env }, refCode) {
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  const ref = await getRefPointer(ddb, tableName, refCode);
  if (!ref) throw err(404, "not found");
  const need = await getNeedById(ddb, tableName, ref.needId);
  if (!need) throw err(404, "not found");
  const donation = need.donationRef ? await getDonation(ddb, tableName, need.donationRef) : undefined;
  return json(200, toStatusView(need, { donation }));
}

export async function handlePostRenew(event, { getDdb, env }, refCode) {
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  const ref = await getRefPointer(ddb, tableName, refCode);
  if (!ref) throw err(404, "not found");
  const need = await getNeedById(ddb, tableName, ref.needId);
  if (!need) throw err(404, "not found");
  if (!["pending", "published", "matched"].includes(need.status)) throw err(409, "need_not_renewable");
  const expiresAt = await renewNeed(ddb, tableName, { ref, need });
  return json(200, { expiresAt });
}

export async function handlePostNeedStatus(event, opts, needId) {
  const { auth } = opts;
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
  await setNeedStatus(ddb, tableName, { need, status, offerId, expectedStatus: need.status });
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

export async function handlePostNeedEdit(event, opts, needId) {
  const { auth } = opts;
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { edits } = body;
  if (!edits || typeof edits !== "object") throw err(400, "edits required");
  const tableName = auth.tableName;
  const ddb = auth.ddb;
  const need = await getNeedById(ddb, tableName, needId);
  if (!need) throw err(404, "not found");
  if (isOutOfScope(auth.user, need)) throw err(403, "out_of_scope");
  if (need.status === "pending" || need.status === "rejected") throw err(400, "need must be published before edit");
  const expectedStatus = need.status;
  applyModerationEdits("NEED", need, edits);
  await setNeedStatus(ddb, tableName, { need, status: need.status, expectedStatus });
  const actorName = auth.user?.name || auth.payload.name || "";
  const targetLabel = getTargetLabelForAudit("NEED", need);
  await recordAudit(ddb, tableName, { actorSub: auth.payload.sub, actorName, action: "edit", targetType: "NEED", targetId: needId, targetLabel });
  return json(200, { status: need.status });
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
  const { auth } = opts;
  const status = getQuery(event).status === "resolved" ? "resolved" : "open";
  const tableName = auth.tableName;
  const ddb = auth.ddb;
  const pointers = await listFlaggedPointers(ddb, tableName);
  const out = [];
  for (const p of pointers) {
    const needId = p.needId || p.SK;
    const flags = await listFlagsForNeed(ddb, tableName, needId, status);
    out.push(toFlagListItem(p, flags));
  }
  let filtered = out.filter((item) => item.flags.length > 0);
  if (auth.role === "moderator" && Array.isArray(auth.user?.districts) && auth.user.districts.length > 0) {
    filtered = out.filter((it) => !isOutOfScope(auth.user, it.district));
  }
  filtered.sort((a, b) => b.flagCount - a.flagCount || a.maskedName.localeCompare(b.maskedName));
  return json(200, { items: filtered });
}

export async function handleResolveFlag(event, opts, flagId) {
  const { auth } = opts;
  const body = parseBody(event) || {};
  if (typeof body !== "object") throw err(400, "invalid body");
  const note = body.note === undefined || body.note === null ? undefined : String(body.note).trim();
  if (note && note.length > 500) throw err(400, "note too long");
  const separator = String(flagId).indexOf("|");
  if (separator < 1) throw err(400, "invalid flag");
  const needId = String(flagId).slice(0, separator);
  const sk = String(flagId).slice(separator + 1);
  const need = await getNeedById(auth.ddb, auth.tableName, needId);
  if (!need) throw err(404, "not found");
  if (isOutOfScope(auth.user, need)) throw err(403, "out_of_scope");
  const result = await auth.ddb.send(new GetCommand({ TableName: auth.tableName, Key: { PK: `NEED#${needId}`, SK: sk } }));
  const flag = result.Item;
  if (!flag || flag.type !== "FLAG") throw err(404, "not found");
  if (flag.status !== "resolved") {
    flag.status = "resolved";
    flag.resolvedAt = new Date().toISOString();
    flag.resolvedBy = auth.payload.sub;
    if (note) flag.resolutionNote = note;
    await auth.ddb.send(new PutCommand({ TableName: auth.tableName, Item: flag }));
    const actorName = auth.user?.name || auth.payload.name || "";
    await recordAudit(auth.ddb, auth.tableName, { actorSub: auth.payload.sub, actorName, action: "flag.resolve", targetType: "NEED", targetId: needId, targetLabel: getTargetLabelForAudit("NEED", need), reason: note });
  }
  return json(200, { status: "resolved" });
}
