import { json, err, getQuery, parseBody, stripInternal } from "../lib/http.js";
import { validateString, validateOptionalString, validateDistrict, validateNeedMedia } from "../lib/validate.js";
import { requireAuth } from "../lib/auth.js";
import { recordAudit } from "../models/audit.js";
import { createIncident, getIncidentById, saveIncident, listIncidentsByStatus } from "../models/incident.js";

const INCIDENT_STATUSES = ["draft", "pending", "active", "archived", "rejected"];
const PUBLIC_INCIDENT_STATUSES = ["active", "pending", "archived"];

function requireAdmin(auth) {
  if (auth.role !== "admin") throw err(403, "Forbidden");
}

function cleanSourceAttribution(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) throw err(400, "sourceAttribution must be object");
  return {
    label: validateString(value.label, "sourceAttribution.label", 1, 200),
    url: validateString(value.url, "sourceAttribution.url", 1, 2000),
  };
}

function cleanStartedAt(value) {
  const out = validateString(value, "startedAt", 10, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out)) throw err(400, "startedAt must be YYYY-MM-DD");
  return out;
}

function cleanAffectedDistricts(value) {
  if (!Array.isArray(value) || value.length === 0) throw err(400, "affectedDistricts must be non-empty array");
  return Array.from(new Set(value.map((district) => validateDistrict(district, "affectedDistricts[]"))));
}

function cleanAdminIncidentBody(body) {
  const proofMedia = validateNeedMedia(body.proofMedia);
  const out = {
    name: validateString(body.name, "name", 2, 150),
    kind: validateString(body.kind, "kind", 1, 50),
    startedAt: cleanStartedAt(body.startedAt),
    affectedDistricts: cleanAffectedDistricts(body.affectedDistricts),
    status: "draft",
    requestOrigin: "admin",
    createdBy: undefined,
  };
  const nameNe = validateOptionalString(body.nameNe, "nameNe", 1, 150);
  const summary = validateOptionalString(body.summary, "summary", 1, 2000);
  const summaryNe = validateOptionalString(body.summaryNe, "summaryNe", 1, 2000);
  const coverImageUrl = validateOptionalString(body.coverImageUrl, "coverImageUrl", 1, 2000);
  const landingPagePath = validateOptionalString(body.landingPagePath, "landingPagePath", 1, 500);
  const sourceAttribution = cleanSourceAttribution(body.sourceAttribution);
  if (nameNe !== undefined) out.nameNe = nameNe;
  if (summary !== undefined) out.summary = summary;
  if (summaryNe !== undefined) out.summaryNe = summaryNe;
  if (coverImageUrl !== undefined) out.coverImageUrl = coverImageUrl;
  if (landingPagePath !== undefined) out.landingPagePath = landingPagePath;
  if (sourceAttribution !== undefined) out.sourceAttribution = sourceAttribution;
  if (proofMedia !== undefined) out.proofMedia = proofMedia;
  return out;
}

function parseStatuses(raw, allowed, defaultStatus) {
  if (raw === undefined || raw === null) return [defaultStatus];
  const values = String(raw).split(",").map((value) => value.trim()).filter(Boolean);
  const valid = Array.from(new Set(values.filter((value) => allowed.includes(value))));
  if (valid.length === 0) throw err(400, "invalid status");
  return valid;
}

async function listResponse(ddb, tableName, statuses) {
  const items = await listIncidentsByStatus(ddb, tableName, statuses);
  return { items: items.map(stripInternal) };
}

export async function handleGetIncidents(event, { getDdb, env }) {
  const q = getQuery(event);
  const statuses = parseStatuses(q.status, PUBLIC_INCIDENT_STATUSES, "active");
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  return json(200, await listResponse(getDdb(), tableName, statuses));
}

export async function handleGetAdminIncidents(event, opts) {
  const auth = await requireAuth(event, opts);
  requireAdmin(auth);
  const q = getQuery(event);
  const statuses = parseStatuses(q.status, INCIDENT_STATUSES, "pending");
  return json(200, await listResponse(auth.ddb, auth.tableName, statuses));
}

export async function handlePostAdminIncident(event, opts) {
  const auth = await requireAuth(event, opts);
  requireAdmin(auth);
  const body = parseBody(event);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw err(400, "invalid body");
  const fields = cleanAdminIncidentBody(body);
  fields.createdBy = auth.payload.sub;
  const { id } = await createIncident(auth.ddb, auth.tableName, fields);
  await recordAudit(auth.ddb, auth.tableName, { actorSub: auth.payload.sub, actorName: auth.user?.name || auth.payload.name || "", action: "create", targetType: "INCIDENT", targetId: id, targetLabel: fields.name });
  return json(201, { id, status: "draft" });
}

export async function handlePostIncidentRequest(event, opts) {
  const auth = await requireAuth(event, opts);
  const body = parseBody(event);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw err(400, "invalid body");
  const name = validateString(body.name, "name", 2, 150);
  const kind = validateString(body.kind, "kind", 1, 50);
  const district = validateDistrict(body.district, "district");
  const description = validateString(body.description, "description", 10, 2000);
  const media = validateNeedMedia(body.media);
  if (!media || !media.some((item) => item.type === "photo")) throw err(400, "media must include at least one photo");
  const { id } = await createIncident(auth.ddb, auth.tableName, {
    name,
    kind,
    startedAt: new Date().toISOString().slice(0, 10),
    affectedDistricts: [district],
    summary: description,
    status: "pending",
    requestOrigin: "community-request",
    createdBy: auth.payload.sub,
    proofMedia: media,
  });
  return json(201, { id, status: "pending" });
}

async function getAdminIncident(auth, incidentId) {
  const incident = await getIncidentById(auth.ddb, auth.tableName, incidentId);
  if (!incident) throw err(404, "not found");
  return incident;
}

export async function handlePublishIncident(event, opts, incidentId) {
  const auth = await requireAuth(event, opts);
  requireAdmin(auth);
  const incident = await getAdminIncident(auth, incidentId);
  if (incident.status !== "draft") throw err(400, "only draft incidents can be published");
  incident.status = "active";
  incident.gsi1pk = "INCIDENT#active";
  incident.gsi1sk = incident.createdAt;
  await saveIncident(auth.ddb, auth.tableName, incident);
  await recordAudit(auth.ddb, auth.tableName, { actorSub: auth.payload.sub, actorName: auth.user?.name || auth.payload.name || "", action: "publish", targetType: "INCIDENT", targetId: incidentId, targetLabel: incident.name });
  return json(200, { status: "active" });
}

export async function handleArchiveIncident(event, opts, incidentId) {
  const auth = await requireAuth(event, opts);
  requireAdmin(auth);
  const incident = await getAdminIncident(auth, incidentId);
  if (incident.status !== "active") throw err(400, "only active incidents can be archived");
  incident.status = "archived";
  incident.gsi1pk = "INCIDENT#archived";
  incident.gsi1sk = incident.createdAt;
  await saveIncident(auth.ddb, auth.tableName, incident);
  await recordAudit(auth.ddb, auth.tableName, { actorSub: auth.payload.sub, actorName: auth.user?.name || auth.payload.name || "", action: "archive", targetType: "INCIDENT", targetId: incidentId, targetLabel: incident.name });
  return json(200, { status: "archived" });
}

export async function handleApproveIncident(event, opts, incidentId) {
  const auth = await requireAuth(event, opts);
  requireAdmin(auth);
  const incident = await getAdminIncident(auth, incidentId);
  if (incident.requestOrigin !== "community-request") throw err(400, "only footer-flow incidents can be approved");
  if (incident.status !== "pending") throw err(400, "only pending incidents can be approved");
  const now = new Date().toISOString();
  incident.status = "active";
  incident.approvedBy = auth.payload.sub;
  incident.approvedAt = now;
  incident.gsi1pk = "INCIDENT#active";
  incident.gsi1sk = incident.createdAt;
  await saveIncident(auth.ddb, auth.tableName, incident);
  await recordAudit(auth.ddb, auth.tableName, { actorSub: auth.payload.sub, actorName: auth.user?.name || auth.payload.name || "", action: "approve", targetType: "INCIDENT", targetId: incidentId, targetLabel: incident.name });
  return json(200, { status: "active" });
}

export async function handleRejectIncident(event, opts, incidentId) {
  const auth = await requireAuth(event, opts);
  requireAdmin(auth);
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const reason = validateString(body.reason, "reason", 5, 1000);
  const incident = await getAdminIncident(auth, incidentId);
  if (incident.requestOrigin !== "community-request") throw err(400, "only footer-flow incidents can be rejected");
  if (incident.status !== "pending") throw err(400, "only pending incidents can be rejected");
  incident.status = "rejected";
  incident.rejectionReason = reason;
  incident.gsi1pk = "INCIDENT#rejected";
  incident.gsi1sk = incident.createdAt;
  await saveIncident(auth.ddb, auth.tableName, incident);
  await recordAudit(auth.ddb, auth.tableName, { actorSub: auth.payload.sub, actorName: auth.user?.name || auth.payload.name || "", action: "reject", targetType: "INCIDENT", targetId: incidentId, targetLabel: incident.name, reason });
  return json(200, { status: "rejected" });
}
