import { json, err, getQuery, parseBody } from "../lib/http.js";
import { isOutOfScope } from "../lib/auth.js";
import { validateDistrict, validateOptionalString, validatePhone, validateString } from "../lib/validate.js";
import { getMunicipality, municipalityInDistrict, wardInMunicipality } from "../lib/adminUnits.js";
import { expandKit, getKit } from "../lib/kits.js";
import { isGoodsCategory } from "../lib/goods-taxonomy.js";
import { getOrg, getMembership } from "../models/org.js";
import { getIncidentById } from "../models/incident.js";
import { createDistribution, getDistribution, listDistributions, listDistributionsForIncident, saveDistribution } from "../models/distribution.js";
import { recordAudit } from "../models/audit.js";
import { toPrivateDistributionView, toPublicDistributionView, toDdmcCsv, toDdmcJson } from "../views/distribution.js";

const TRANSPORTS = ["vehicle", "drone", "porter", "helicopter", "other"];
const STATUSES = ["planned", "acknowledged", "completed", "cancelled"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(date, days) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function validateDate(value, name = "date") {
  if (typeof value !== "string" || !DATE_RE.test(value)) throw err(400, `${name} must be YYYY-MM-DD`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw err(400, `${name} must be YYYY-MM-DD`);
  return value;
}

function validatePlannedDate(value) {
  const date = validateDate(value, "plannedDate");
  const today = todayUtc();
  if (date < shiftDate(today, -1) || date > shiftDate(today, 30)) throw err(400, "plannedDate must be today-1 to today+30");
  return date;
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length < 1) throw err(400, "items must be a non-empty array");
  if (items.length > 50) throw err(400, "items must have at most 50 lines");
  const expanded = [];
  for (const [index, line] of items.entries()) {
    if (!line || typeof line !== "object" || Array.isArray(line)) throw err(400, `items[${index}] must be an object`);
    if (line.kitId !== undefined && line.kitId !== null && line.kitId !== "") {
      const kitId = validateString(line.kitId, `items[${index}].kitId`, 1, 100);
      if (!getKit(kitId)) throw err(400, `items[${index}].kitId is unknown`);
      const households = line.households === undefined ? 1 : line.households;
      if (!Number.isInteger(households) || households < 1 || households > 100000) throw err(400, `items[${index}].households must be integer 1-100000`);
      const kit = expandKit(kitId, households);
      for (const item of kit.items) {
        if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 100000) throw err(400, `items[${index}] expanded quantity must be integer 1-100000`);
        expanded.push({ ...item, kitId, households });
      }
      continue;
    }
    const category = validateString(line.category, `items[${index}].category`, 1, 100);
    if (!isGoodsCategory(category)) throw err(400, `items[${index}].category is invalid`);
    const qty = line.qty;
    if (!Number.isInteger(qty) || qty < 1 || qty > 100000) throw err(400, `items[${index}].qty must be integer 1-100000`);
    const unit = validateString(line.unit, `items[${index}].unit`, 1, 30);
    expanded.push({ category, qty, unit });
  }
  return expanded;
}

function validateDistributionBody(body) {
  const incidentId = validateString(body.incidentId, "incidentId", 1, 200);
  const district = validateDistrict(body.district);
  const municipalityId = body.municipalityId;
  if (!Number.isInteger(municipalityId) || !municipalityInDistrict(municipalityId, district)) throw err(400, "municipalityId: municipality is not in that district");
  if (!Array.isArray(body.wards) || body.wards.length < 1 || body.wards.length > 15) throw err(400, "wards must have 1-15 entries");
  const wards = [...new Set(body.wards)].map((ward) => {
    if (!Number.isInteger(ward) || !wardInMunicipality(municipalityId, ward)) throw err(400, "ward out of range for municipality");
    return ward;
  });
  if (wards.length !== body.wards.length) throw err(400, "wards must be unique");
  const plannedDate = validatePlannedDate(body.plannedDate);
  const items = validateItems(body.items);
  const transport = validateString(body.transport, "transport", 1, 30);
  if (!TRANSPORTS.includes(transport)) throw err(400, "transport must be vehicle|drone|porter|helicopter|other");
  const staffCount = body.staffCount === undefined ? 0 : body.staffCount;
  if (!Number.isInteger(staffCount) || staffCount < 0 || staffCount > 500) throw err(400, "staffCount must be integer 0-500");
  const contactPhone = validatePhone(body.contactPhone, "contactPhone");
  const notes = validateOptionalString(body.notes, "notes", 1, 2000);
  return { incidentId, district, municipalityId, wards, plannedDate, items, transport, staffCount, contactPhone, notes };
}

async function requireVerifiedMember(auth, orgId) {
  const org = await getOrg(auth.ddb, auth.tableName, orgId);
  if (!org) throw err(404, "not found");
  if (!(await getMembership(auth.ddb, auth.tableName, auth.payload.sub, orgId))) throw err(403, "Forbidden");
  if (org.status !== "verified") throw err(403, "org_not_verified");
  return org;
}

function actor(auth) {
  return { actorSub: auth.payload.sub, actorName: auth.user?.name || auth.payload.name || "" };
}

function auditLabel(distribution) {
  const municipality = getMunicipality(distribution.municipalityId)?.name || distribution.municipalityId;
  return `${distribution.orgName} · ${municipality} wards ${distribution.wards.join(", ")}`;
}

async function saveState(auth, distribution, status, expectedStatuses, extra = {}) {
  const next = { ...distribution, ...extra, status, updatedAt: new Date().toISOString(), gsi2pk: `DIST#${status}` };
  await saveDistribution(auth.ddb, auth.tableName, next, expectedStatuses);
  return next;
}

export async function handlePostDistribution(event, opts, orgId) {
  const { auth } = opts;
  const org = await requireVerifiedMember(auth, orgId);
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const validated = validateDistributionBody(body);
  const incident = await getIncidentById(auth.ddb, auth.tableName, validated.incidentId);
  if (!incident || incident.status !== "active") throw err(400, "incident must be active");
  const item = await createDistribution(auth.ddb, auth.tableName, {
    ...validated,
    orgId,
    orgName: org.name,
    orgTier: org.tier,
    createdBy: auth.payload.sub,
  });
  await recordAudit(auth.ddb, auth.tableName, { ...actor(auth), action: "distribution.file", targetType: "DISTRIBUTION", targetId: item.id, targetLabel: auditLabel(item) });
  return json(201, toPrivateDistributionView(item));
}

export async function handleListOrgDistributions(event, opts, orgId) {
  const { auth } = opts;
  await requireVerifiedMember(auth, orgId);
  const items = await listDistributions(auth.ddb, auth.tableName, { orgId });
  return json(200, { items: items.map(toPrivateDistributionView) });
}

async function getOrgDistribution(auth, orgId, id) {
  const distribution = await getDistribution(auth.ddb, auth.tableName, id);
  if (!distribution || distribution.orgId !== orgId) throw err(404, "not found");
  return distribution;
}

export async function handleCompleteDistribution(event, opts, orgId, id) {
  const { auth } = opts;
  await requireVerifiedMember(auth, orgId);
  const distribution = await getOrgDistribution(auth, orgId, id);
  const body = parseBody(event) || {};
  const householdsReached = body.householdsReached;
  if (!Number.isInteger(householdsReached) || householdsReached < 1 || householdsReached > 100000) throw err(400, "householdsReached must be integer 1-100000");
  const note = validateOptionalString(body.note, "note", 1, 1000);
  const completed = await saveState(auth, distribution, "completed", ["planned", "acknowledged"], { completedAt: new Date().toISOString(), householdsReached, ...(note === undefined ? {} : { completedNote: note }) });
  await recordAudit(auth.ddb, auth.tableName, { ...actor(auth), action: "distribution.complete", targetType: "DISTRIBUTION", targetId: id, targetLabel: auditLabel(completed) });
  return json(200, toPrivateDistributionView(completed));
}

export async function handleCancelDistribution(event, opts, orgId, id) {
  const { auth } = opts;
  await requireVerifiedMember(auth, orgId);
  const distribution = await getOrgDistribution(auth, orgId, id);
  const cancelled = await saveState(auth, distribution, "cancelled", ["planned", "acknowledged"]);
  await recordAudit(auth.ddb, auth.tableName, { ...actor(auth), action: "distribution.cancel", targetType: "DISTRIBUTION", targetId: id, targetLabel: auditLabel(cancelled) });
  return json(200, toPrivateDistributionView(cancelled));
}

export async function handleGetModerationDistributions(event, opts) {
  const { auth } = opts;
  const q = getQuery(event);
  const status = String(q.status || "planned").trim();
  if (!STATUSES.includes(status)) throw err(400, "invalid status");
  const items = (await listDistributions(auth.ddb, auth.tableName, { status })).filter((item) => !isOutOfScope(auth.user, item.district));
  return json(200, { items: items.map(toPrivateDistributionView) });
}

export async function handleAckDistribution(event, opts, id) {
  const { auth } = opts;
  const distribution = await getDistribution(auth.ddb, auth.tableName, id);
  if (!distribution) throw err(404, "not found");
  if (isOutOfScope(auth.user, distribution.district)) throw err(403, "out_of_scope");
  const body = parseBody(event) || {};
  const note = validateOptionalString(body.note, "note", 1, 1000);
  const acked = await saveState(auth, distribution, "acknowledged", ["planned"], {
    ackBy: { sub: auth.payload.sub, name: auth.user?.name || auth.payload.name || "", role: auth.role },
    ackAt: new Date().toISOString(),
    ...(note === undefined ? {} : { ackNote: note }),
  });
  await recordAudit(auth.ddb, auth.tableName, { ...actor(auth), action: "distribution.ack", targetType: "DISTRIBUTION", targetId: id, targetLabel: auditLabel(acked), reason: "on behalf of the district office" });
  return json(200, toPrivateDistributionView(acked));
}

export async function handleGetPublicDistributions(event, { getDdb, env }) {
  const q = getQuery(event);
  const incidentId = validateString(q.incidentId, "incidentId", 1, 200);
  const district = q.district ? validateDistrict(q.district) : undefined;
  const items = await listDistributionsForIncident(getDdb(), env.TABLE_NAME, { incidentId, district });
  const response = json(200, { items: items.map(toPublicDistributionView) });
  response.headers["cache-control"] = "public, max-age=300";
  return response;
}

export async function handleGetDdmcLog(event, { getDdb, env }) {
  const q = getQuery(event);
  const district = validateDistrict(q.district, "district");
  const date = validateDate(q.date, "date");
  const format = String(q.format || "csv").toLowerCase();
  if (!["csv", "json"].includes(format)) throw err(400, "format must be csv or json");
  const items = await listDistributions(getDdb(), env.TABLE_NAME, { district, plannedDate: date });
  const safeDistrict = district.replace(/[^a-z0-9-]/gi, "");
  if (format === "json") return { statusCode: 200, headers: { "content-type": "application/json", "cache-control": "public, max-age=300" }, body: JSON.stringify({ rows: toDdmcJson(items) }) };
  return {
    statusCode: 200,
    headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "public, max-age=300", "content-disposition": `attachment; filename="verifiednepal-ddmc-${safeDistrict}-${date}.csv"` },
    body: toDdmcCsv(items),
  };
}
