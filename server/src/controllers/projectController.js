import { json, err, getQuery, parseBody, encodeCursor, decodeCursor, stripInternal } from "../lib/http.js";
import { validateString, validatePhone, validateOptionalEmail, validateTitle, validateDescription, validateDistrict } from "../lib/validate.js";
import { verifyTurnstile } from "../lib/turnstile.js";
import { isOutOfScope, verifyCommitteeAuth, authorizeProjectWrite } from "../lib/auth.js";
import { PROJECT_TYPES, ALLOWED_PHOTO_TYPES, MAX_PHOTO_SIZE } from "../constants.js";
import {
  createProject, getProjectById, listPublicProjects, listProjectUpdates,
  addPhotoToProject, addProjectUpdate, listModerationProjects, moderateProject, moderateProjectUpdate,
} from "../models/project.js";
import { requestPresign } from "../models/media.js";
import { recordAudit, getTargetLabelForAudit } from "../models/audit.js";
import { toPublicProject, toPublishedUpdatesView } from "../views/project.js";
import { PUBLIC_PROJECT_STATUSES } from "../constants.js";
import { getIncidentById } from "../models/incident.js";

export async function handlePostProject(event, { getDdb, env }) {
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { title, description, type, district, ward, locationText, costEstimateNpr, committee, turnstileToken, incidentId } = body;
  await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET, { required: env.REQUIRE_TURNSTILE === "1" });
  const titleObj = validateTitle(title, "title");
  const descObj = validateDescription(description, "description");
  if (!PROJECT_TYPES.includes(type)) throw err(400, `type must be one of ${PROJECT_TYPES.join(",")}`);
  const districtClean = validateDistrict(district, "district");
  if (typeof incidentId !== "string" || !incidentId.trim()) throw err(400, "invalid incident");
  if (typeof ward !== "number" || !Number.isInteger(ward) || ward < 1 || ward > 33) throw err(400, "ward must be integer 1-33");
  const locationTextClean = validateString(locationText, "locationText", 1, 500);
  if (typeof costEstimateNpr !== "number" || !Number.isFinite(costEstimateNpr) || costEstimateNpr <= 0 || costEstimateNpr > 1e12) throw err(400, "costEstimateNpr must be positive number");
  const costClean = Math.floor(costEstimateNpr);
  if (!committee || typeof committee !== "object") throw err(400, "committee required");
  const committeeName = validateString(committee.name, "committee.name", 1, 100);
  const contactName = validateString(committee.contactName, "committee.contactName", 1, 100);
  const phone = validatePhone(committee.phone, "committee.phone");
  const email = validateOptionalEmail(committee.email, "committee.email");
  if (!committee.bank || typeof committee.bank !== "object") throw err(400, "committee.bank required");
  const bankName = validateString(committee.bank.bankName, "committee.bank.bankName", 1, 100);
  const accountName = validateString(committee.bank.accountName, "committee.bank.accountName", 1, 100);
  const accountNumber = validateString(committee.bank.accountNumber, "committee.bank.accountNumber", 1, 100);
  let esewaId;
  if (committee.esewaId !== undefined && committee.esewaId !== null && String(committee.esewaId).trim() !== "") {
    esewaId = validateString(committee.esewaId, "committee.esewaId", 1, 100);
  }
  let khaltiId;
  if (committee.khaltiId !== undefined && committee.khaltiId !== null && String(committee.khaltiId).trim() !== "") {
    khaltiId = validateString(committee.khaltiId, "committee.khaltiId", 1, 100);
  }
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  const incident = await getIncidentById(ddb, tableName, incidentId.trim());
  if (!incident || incident.status !== "active") throw err(400, "invalid incident");
  const { id, updateCode } = await createProject(ddb, tableName, {
    titleObj, descObj, type, districtClean, ward, locationTextClean, costClean,
    committeeName, contactName, phone, email, bankName, accountName, accountNumber, esewaId, khaltiId, incidentId: incident.id,
  });
  return json(201, { id, updateCode });
}

export async function handleGetProjects(event, { getDdb, env }) {
  const q = getQuery(event);
  const districtRaw = q.district ? String(q.district).trim() : "";
  const incidentId = q.incidentId ? String(q.incidentId).trim() : "";
  const statusRaw = q.status ? String(q.status).trim() : "";
  const cursorRaw = q.cursor ? String(q.cursor) : "";
  if (!incidentId) throw err(400, "incidentId required");
  const cursorKey = decodeCursor(cursorRaw);
  if (statusRaw && !PUBLIC_PROJECT_STATUSES.includes(statusRaw)) throw err(400, `status must be one of ${PUBLIC_PROJECT_STATUSES.join(",")}`);
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  const items = await listPublicProjects(ddb, tableName, { incidentId, district: districtRaw, status: statusRaw });
  let start = 0;
  if (cursorKey) {
    const idx = items.findIndex((it) => it.PK === cursorKey.PK && it.SK === cursorKey.SK);
    if (idx === -1) throw err(400, "invalid cursor");
    start = idx + 1;
  }
  const limit = 20;
  const sliced = items.slice(start, start + limit);
  const publicItems = sliced.map((it) => toPublicProject(it));
  const body = { items: publicItems };
  if (start + limit < items.length) {
    const last = sliced[sliced.length - 1];
    body.cursor = encodeCursor({ PK: last.PK, SK: last.SK });
  }
  return json(200, body);
}

export async function handleGetProject(event, { getDdb, env }, projectId) {
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  const proj = await getProjectById(ddb, tableName, projectId);
  if (!proj) throw err(404, "not found");
  if (!PUBLIC_PROJECT_STATUSES.includes(proj.status)) throw err(404, "not found");
  const publicProj = toPublicProject(proj);
  const allUpdates = await listProjectUpdates(ddb, tableName, projectId, { scanForward: false });
  const publishedUpdates = toPublishedUpdatesView(allUpdates);
  return json(200, { ...publicProj, updates: publishedUpdates });
}

export async function handlePostPresign(event, opts, projectId) {
  const { env, getDdb, fetchImpl } = opts;
  const ddb = getDdb();
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const proj = await getProjectById(ddb, tableName, projectId);
  if (!proj) throw err(404, "not found");
  const clientIdEarly = env.OU_MEDIA_CLIENT_ID;
  const clientSecretEarly = env.OU_MEDIA_CLIENT_SECRET;
  if (!clientIdEarly || !clientSecretEarly) {
    return json(503, { error: "media_not_configured" });
  }
  const authzPre = await authorizeProjectWrite(event, opts, projectId);
  if (authzPre.isMod && authzPre.auth && isOutOfScope(authzPre.auth.user, proj)) throw err(403, "out_of_scope");
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { filename, contentType, size } = body;
  const fname = validateString(filename, "filename", 1, 255);
  if (!ALLOWED_PHOTO_TYPES.includes(contentType)) throw err(400, `contentType must be one of ${ALLOWED_PHOTO_TYPES.join(",")}`);
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0 || size > MAX_PHOTO_SIZE) throw err(400, `size must be 1-${MAX_PHOTO_SIZE}`);
  const clientId = env.OU_MEDIA_CLIENT_ID;
  if (!clientId) {
    return json(503, { error: "media_not_configured" });
  }
  let out;
  try {
    out = await requestPresign(env, fetchImpl, { filename: fname, contentType });
  } catch (e) {
    if (e.status === 503 || e.code === "media_not_configured") return json(503, { error: "media_not_configured" });
    return json(502, { error: e.code || "media_upstream", message: e.message || "media upstream error" });
  }
  return json(200, out);
}

export async function handlePostPhoto(event, opts, projectId) {
  const { env, getDdb } = opts;
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  const proj = await getProjectById(ddb, tableName, projectId);
  if (!proj) throw err(404, "not found");
  const authz = await authorizeProjectWrite(event, opts, projectId);
  const isMod = authz.isMod;
  if (isMod && authz.auth && isOutOfScope(authz.auth.user, proj)) throw err(403, "out_of_scope");
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { fileId, url, caption } = body;
  const fid = validateString(fileId, "fileId", 1, 200);
  const urlClean = validateString(url, "url", 1, 2000);
  try { const u = new URL(urlClean); if (!["http:", "https:"].includes(u.protocol)) throw new Error(); } catch { throw err(400, "url must be http(s)"); }
  // Bind the photo URL to the configured media host so a caller cannot attach an
  // arbitrary external URL (tracking pixel / offensive image). Derived from server config.
  const mediaBase = env.MEDIA_PUBLIC_BASE ? String(env.MEDIA_PUBLIC_BASE).replace(/\/+$/, "") : "";
  if (mediaBase && !urlClean.startsWith(mediaBase + "/")) throw err(400, "url must be under the media host");
  let captionClean;
  if (caption !== undefined && caption !== null && String(caption).trim() !== "") {
    captionClean = validateString(caption, "caption", 1, 500);
  }
  const status = isMod ? "published" : "pending";
  const photo = await addPhotoToProject(ddb, tableName, proj, { fileId: fid, url: urlClean, caption: captionClean, status });
  return json(201, { ok: true, photo });
}

export async function handlePostUpdate(event, opts, projectId) {
  const { env, getDdb } = opts;
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  const proj = await getProjectById(ddb, tableName, projectId);
  if (!proj) throw err(404, "not found");
  const committee = await verifyCommitteeAuth(event.headers, projectId, getDdb, env);
  if (!committee) throw err(401, "Missing or invalid X-Update-Code");
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { text, photoFileIds, spentNpr } = body;
  const textClean = validateString(text, "text", 10, 5000);
  let fileIds = [];
  if (photoFileIds !== undefined && photoFileIds !== null) {
    if (!Array.isArray(photoFileIds)) throw err(400, "photoFileIds must be array");
    if (photoFileIds.length > 20) throw err(400, "photoFileIds must be at most 20");
    for (const f of photoFileIds) {
      if (typeof f !== "string" || !f.trim() || f.trim().length > 200) throw err(400, "photoFileIds entries must be strings up to 200 chars");
      fileIds.push(f.trim());
    }
  }
  let spent;
  if (spentNpr !== undefined && spentNpr !== null) {
    if (typeof spentNpr !== "number" || !Number.isFinite(spentNpr) || spentNpr < 0 || spentNpr > 1e12) throw err(400, "spentNpr must be a non-negative number ≤ 1e12");
    spent = Math.floor(spentNpr);
  }
  let photos = [];
  if (fileIds.length) {
    const projPhotos = Array.isArray(proj.photos) ? proj.photos : [];
    for (const fid of fileIds) {
      const match = projPhotos.find((p) => p.fileId === fid);
      if (!match) throw err(400, `photoFileId ${fid} not found`);
      photos.push({ fileId: match.fileId, url: match.url });
    }
  }
  const { updateId } = await addProjectUpdate(ddb, tableName, { projectId, text: textClean, photos, spentNpr: spent });
  return json(201, { updateId });
}

export async function handleGetModerationProjects(event, opts) {
  const { auth } = opts;
  let all = await listModerationProjects(auth.ddb, auth.tableName);
  if (auth.role === "moderator" && Array.isArray(auth.user?.districts) && auth.user.districts.length > 0) {
    all = all.filter((proj) => !isOutOfScope(auth.user, proj));
  }
  const items = [];
  for (const proj of all) {
    const updates = await listProjectUpdates(auth.ddb, auth.tableName, proj.id, { scanForward: true });
    const clone = stripInternal(JSON.parse(JSON.stringify(proj)));
    clone.updates = updates;
    items.push(clone);
  }
  return json(200, { items });
}

export async function handlePostModerationProject(event, opts, projectId) {
  const { auth } = opts;
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { action, reason, status, fileId, edits } = body;
  const allowed = ["verify-committee", "publish", "reject", "set-status", "publish-photo", "reject-photo", "edit"];
  if (!allowed.includes(action)) throw err(400, `action must be one of ${allowed.join(",")}`);
  const tableName = auth.tableName;
  const ddb = auth.ddb;
  const proj = await getProjectById(ddb, tableName, projectId);
  if (!proj) throw err(404, "not found");
  if (isOutOfScope(auth.user, proj)) throw err(403, "out_of_scope");
  const result = await moderateProject(ddb, tableName, { proj, action, reason, status, fileId, edits });
  const actorName = auth.user?.name || auth.payload.name || "";
  const targetLabel = getTargetLabelForAudit("PROJECT", proj);
  await recordAudit(ddb, tableName, {
    actorSub: auth.payload.sub, actorName, action: result.auditAction, targetType: "PROJECT", targetId: projectId,
    targetLabel, reason: reason ? String(reason).trim() : undefined,
  });
  return json(200, { status: result.status });
}

export async function handlePostModerationUpdate(event, opts, projectId, updateId) {
  const { auth } = opts;
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { action, reason } = body;
  if (!["publish", "reject"].includes(action)) throw err(400, "action must be publish or reject");
  const tableName = auth.tableName;
  const ddb = auth.ddb;
  const projCheck = await getProjectById(ddb, tableName, projectId);
  if (projCheck && isOutOfScope(auth.user, projCheck)) throw err(403, "out_of_scope");
  const items = await listProjectUpdates(ddb, tableName, projectId, { scanForward: true });
  const target = items.find((it) => it.id === updateId);
  if (!target) throw err(404, "update not found");
  const result = await moderateProjectUpdate(ddb, tableName, { target, action, reason });
  const actorNameU = auth.user?.name || auth.payload.name || "";
  const targetLabelU = getTargetLabelForAudit("UPDATE", target);
  await recordAudit(ddb, tableName, {
    actorSub: auth.payload.sub, actorName: actorNameU, action: `update:${action}`, targetType: "UPDATE", targetId: updateId,
    targetLabel: targetLabelU, reason: reason ? String(reason).trim() : undefined,
  });
  return json(200, { status: result.status });
}
