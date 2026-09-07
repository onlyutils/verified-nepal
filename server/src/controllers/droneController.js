import { json, err, getQuery, parseBody } from "../lib/http.js";
import { isOutOfScope } from "../lib/auth.js";
import { validateDistrict, validateNeedMedia, validateOptionalString, validatePhone, validateString } from "../lib/validate.js";
import { getMunicipality, municipalityInDistrict, wardInMunicipality } from "../lib/adminUnits.js";
import { expandKit, getKit } from "../lib/kits.js";
import { isGoodsCategory } from "../lib/goods-taxonomy.js";
import { getOrg, getMembership } from "../models/org.js";
import { getIncidentById } from "../models/incident.js";
import {
  createDroneOperator, getDroneOperator, listDroneOperators, saveDroneOperator,
  createLandingSite, getLandingSite, listLandingSites,
  createPayloadRequest, getPayloadRequest, listPayloadRequests, savePayloadRequest,
  createMission, getMission, listMissions, saveMission,
} from "../models/drone.js";
import { recordAudit } from "../models/audit.js";
import {
  toPrivateOperatorView, toPublicOperatorView, toPrivateSiteView, toPublicSiteView,
  toPrivateRequestView, toPublicRequestView, toPrivateMissionView, toPublicMissionView,
} from "../views/drone.js";

const PERMIT_STATUSES = ["none", "applied", "granted"];
const OPERATOR_STATUSES = ["active", "inactive"];
const SITE_STATUSES = ["active", "closed"];
const SURFACES = ["field", "road", "roof", "riverbank", "other"];
const REQUEST_STATUSES = ["open", "assigned", "flown", "delivered", "cancelled"];
const PRIORITIES = ["urgent", "normal"];

function bodyObject(event) {
  const body = parseBody(event);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw err(400, "invalid body");
  return body;
}

function actor(auth) { return { actorSub: auth.payload.sub, actorName: auth.user?.name || auth.payload.name || "" }; }

function auditLabel(item) {
  const municipality = getMunicipality(item.municipalityId)?.name || item.municipalityId || item.district || "";
  return `${item.name || item.orgName || item.id} · ${municipality}${item.ward ? ` ward ${item.ward}` : ""}`;
}

async function requireVerifiedMember(auth, orgId) {
  const org = await getOrg(auth.ddb, auth.tableName, orgId);
  if (!org) throw err(404, "not found");
  if (!(await getMembership(auth.ddb, auth.tableName, auth.payload.sub, orgId))) throw err(403, "Forbidden");
  if (org.status !== "verified") throw err(403, "org_not_verified");
  return org;
}

function number(value, name, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw err(400, `${name} must be ${min}-${max}`);
  return value;
}

function integer(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw err(400, `${name} must be integer ${min}-${max}`);
  return value;
}

function enumValue(value, name, values) {
  const clean = validateString(value, name, 1, 40);
  if (!values.includes(clean)) throw err(400, `${name} is invalid`);
  return clean;
}

function validateMunicipalityLocation(body) {
  const district = validateDistrict(body.district);
  const municipalityId = body.municipalityId;
  if (!Number.isInteger(municipalityId) || !municipalityInDistrict(municipalityId, district)) throw err(400, "municipalityId: municipality is not in that district");
  const ward = integer(body.ward, "ward", 1, 400);
  if (!wardInMunicipality(municipalityId, ward)) throw err(400, "ward out of range for municipality");
  return { district, municipalityId, ward };
}

function validateOperatorBody(body, org, existing = {}) {
  const aircraft = validateString(body.aircraft ?? existing.aircraft, "aircraft", 1, 120);
  const payloadKg = number(body.payloadKg ?? existing.payloadKg, "payloadKg", 0.1, 500);
  const rangeKm = number(body.rangeKm ?? existing.rangeKm, "rangeKm", 1, 500);
  const baseDistrict = validateDistrict(body.baseDistrict ?? existing.baseDistrict, "baseDistrict");
  const baseMunicipalityId = body.baseMunicipalityId ?? existing.baseMunicipalityId;
  if (baseMunicipalityId !== undefined && baseMunicipalityId !== null && (!Number.isInteger(baseMunicipalityId) || !municipalityInDistrict(baseMunicipalityId, baseDistrict))) throw err(400, "baseMunicipalityId: municipality is not in that district");
  const caanUin = validateOptionalString(body.caanUin ?? existing.caanUin, "caanUin", 1, 120);
  const permitStatus = enumValue(body.permitStatus ?? existing.permitStatus ?? "none", "permitStatus", PERMIT_STATUSES);
  const permitRef = validateOptionalString(body.permitRef ?? existing.permitRef, "permitRef", 1, 120);
  const contactPhone = validatePhone(body.contactPhone ?? existing.contactPhone, "contactPhone");
  const status = enumValue(body.status ?? existing.status ?? "active", "status", OPERATOR_STATUSES);
  return {
    orgId: org.id, orgName: org.name, aircraft, payloadKg, rangeKm,
    ...(caanUin === undefined ? {} : { caanUin }), permitStatus,
    ...(permitRef === undefined ? {} : { permitRef }), baseDistrict,
    ...(baseMunicipalityId === undefined || baseMunicipalityId === null ? {} : { baseMunicipalityId }), contactPhone, status,
  };
}

function validateSiteBody(body, registeredBy) {
  const location = validateMunicipalityLocation(body);
  const name = validateString(body.name, "name", 1, 120);
  const lat = number(body.lat, "lat", 26, 31);
  const lng = number(body.lng, "lng", 80, 89);
  const clearanceM = number(body.clearanceM, "clearanceM", 5, 200);
  const surface = enumValue(body.surface, "surface", SURFACES);
  const groundContactName = validateString(body.groundContactName, "groundContactName", 1, 120);
  const groundContactPhone = validatePhone(body.groundContactPhone, "groundContactPhone");
  const photo = body.photo === undefined || body.photo === null ? undefined : validateNeedMedia([body.photo])[0];
  const status = enumValue(body.status ?? "active", "status", SITE_STATUSES);
  return { ...location, name, lat, lng, clearanceM, surface, groundContactName, groundContactPhone, ...(photo ? { photo } : {}), registeredBy, status };
}

function validateIso(value, name) {
  const clean = validateString(value, name, 16, 60);
  const time = Date.parse(clean);
  if (Number.isNaN(time) || !clean.includes("T")) throw err(400, `${name} must be ISO date-time`);
  return { value: clean, time };
}

function validateWindow(startValue, endValue) {
  const start = validateIso(startValue, "windowStart");
  const end = validateIso(endValue, "windowEnd");
  const now = Date.now();
  if (end.time <= start.time || start.time < now || end.time > now + 14 * 86400000) throw err(400, "window must be in the next 14 days and end after start");
  return { windowStart: start.value, windowEnd: end.value };
}

function validateRequestItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) throw err(400, "items must have 1-50 lines");
  const expanded = [];
  let kitWeight = 0;
  let hasKit = false;
  for (const [index, line] of items.entries()) {
    if (!line || typeof line !== "object" || Array.isArray(line)) throw err(400, `items[${index}] must be an object`);
    if (line.kitId !== undefined && line.kitId !== null && line.kitId !== "") {
      const kitId = validateString(line.kitId, `items[${index}].kitId`, 1, 100);
      if (!getKit(kitId)) throw err(400, `items[${index}].kitId is unknown`);
      const households = line.households === undefined ? 1 : integer(line.households, `items[${index}].households`, 1, 100000);
      const kit = expandKit(kitId, households);
      kitWeight += kit.weightKg;
      hasKit = true;
      for (const item of kit.items) expanded.push({ ...item, kitId, households });
    } else {
      const category = validateString(line.category, `items[${index}].category`, 1, 100);
      if (!isGoodsCategory(category)) throw err(400, `items[${index}].category is invalid`);
      expanded.push({ category, qty: integer(line.qty, `items[${index}].qty`, 1, 100000), unit: validateString(line.unit, `items[${index}].unit`, 1, 30) });
    }
  }
  return { items: expanded, hasKit, kitWeight };
}

function validateRequestBody(body) {
  const incidentId = validateString(body.incidentId, "incidentId", 1, 200);
  const location = validateMunicipalityLocation(body);
  const items = validateRequestItems(body.items);
  const weightKg = items.hasKit ? items.kitWeight : number(body.weightKg, "weightKg", 0.1, 500);
  if (items.hasKit && (weightKg < 0.1 || weightKg > 500)) throw err(400, "computed weightKg must be 0.1-500");
  const landingSiteId = validateOptionalString(body.landingSiteId, "landingSiteId", 1, 120);
  const coldChain = body.coldChain === undefined ? false : body.coldChain;
  if (typeof coldChain !== "boolean") throw err(400, "coldChain must be boolean");
  const priority = enumValue(body.priority ?? "normal", "priority", PRIORITIES);
  const window = validateWindow(body.windowStart, body.windowEnd);
  const contactPhone = validatePhone(body.contactPhone, "contactPhone");
  return { incidentId, ...location, ...(landingSiteId ? { landingSiteId } : {}), items: items.items, weightKg, coldChain, priority, ...window, contactPhone };
}

function updateRequest(request, extra = {}) {
  const updatedAt = new Date().toISOString();
  return { ...request, ...extra, updatedAt, gsi2pk: `DRONEREQ#${extra.status || request.status}` };
}

async function requireOrgRequest(auth, orgId, id) {
  const request = await getPayloadRequest(auth.ddb, auth.tableName, id);
  if (!request || (request.assignedOrgId && request.assignedOrgId !== orgId && request.requestedBy?.orgId !== orgId)) throw err(404, "not found");
  return request;
}

export async function handleCreateDroneOperator(event, opts, orgId) {
  const { auth } = opts;
  const org = await requireVerifiedMember(auth, orgId);
  const item = await createDroneOperator(auth.ddb, auth.tableName, validateOperatorBody(bodyObject(event), org));
  await recordAudit(auth.ddb, auth.tableName, { ...actor(auth), action: "drone.operator_add", targetType: "OPERATOR", targetId: item.id, targetLabel: `${org.name} · ${item.aircraft}` });
  return json(201, toPrivateOperatorView(item));
}

export async function handleListDroneOperators(event, opts, orgId) {
  const { auth } = opts;
  await requireVerifiedMember(auth, orgId);
  const q = getQuery(event);
  return json(200, { items: (await listDroneOperators(auth.ddb, auth.tableName, { orgId, status: q.status })).map(toPrivateOperatorView) });
}

export async function handleUpdateDroneOperator(event, opts, orgId, id) {
  const { auth } = opts;
  const org = await requireVerifiedMember(auth, orgId);
  const operator = await getDroneOperator(auth.ddb, auth.tableName, id);
  if (!operator || operator.orgId !== orgId) throw err(404, "not found");
  const body = bodyObject(event);
  const fields = validateOperatorBody(body, org, operator);
  const next = await saveDroneOperator(auth.ddb, auth.tableName, { ...operator, ...fields, gsi1pk: `DRONEOP#${fields.baseDistrict}`, gsi2pk: `DRONEOP#${fields.status}` });
  return json(200, toPrivateOperatorView(next));
}

export async function handleCreateLandingSite(event, opts, orgId) {
  const { auth } = opts;
  await requireVerifiedMember(auth, orgId);
  const item = await createLandingSite(auth.ddb, auth.tableName, validateSiteBody(bodyObject(event), { kind: "org", orgId, sub: auth.payload.sub }));
  await recordAudit(auth.ddb, auth.tableName, { ...actor(auth), action: "drone.site_add", targetType: "LANDING_SITE", targetId: item.id, targetLabel: auditLabel(item) });
  return json(201, toPrivateSiteView(item));
}

export async function handleListLandingSites(event, opts, orgId) {
  const { auth } = opts;
  await requireVerifiedMember(auth, orgId);
  const q = getQuery(event);
  const items = await listLandingSites(auth.ddb, auth.tableName, { district: q.district, status: q.status });
  return json(200, { items: items.filter((item) => item.registeredBy?.orgId === orgId).map(toPrivateSiteView) });
}

async function createRequest(auth, body, requestedBy) {
  const validated = validateRequestBody(body);
  const incident = await getIncidentById(auth.ddb, auth.tableName, validated.incidentId);
  if (!incident || incident.status !== "active") throw err(400, "incident must be active");
  if (validated.landingSiteId) {
    const site = await getLandingSite(auth.ddb, auth.tableName, validated.landingSiteId);
    if (!site || site.status !== "active" || site.district !== validated.district || site.municipalityId !== validated.municipalityId || site.ward !== validated.ward) throw err(400, "landingSiteId is not an active site at this location");
  }
  return createPayloadRequest(auth.ddb, auth.tableName, { ...validated, requestedBy });
}

export async function handleCreateOrgPayloadRequest(event, opts, orgId) {
  const { auth } = opts;
  await requireVerifiedMember(auth, orgId);
  const item = await createRequest(auth, bodyObject(event), { kind: "org", orgId, sub: auth.payload.sub, name: auth.user?.name || auth.payload.name || "" });
  await recordAudit(auth.ddb, auth.tableName, { ...actor(auth), action: "drone.request", targetType: "PAYLOAD_REQUEST", targetId: item.id, targetLabel: auditLabel(item) });
  return json(201, toPrivateRequestView(item));
}

export async function handleCreateModeratorPayloadRequest(event, opts) {
  const { auth } = opts;
  const body = bodyObject(event);
  const district = validateDistrict(body.district);
  if (isOutOfScope(auth.user, district)) throw err(403, "out_of_scope");
  const item = await createRequest(auth, body, { kind: "moderator", sub: auth.payload.sub, name: auth.user?.name || auth.payload.name || "" });
  await recordAudit(auth.ddb, auth.tableName, { ...actor(auth), action: "drone.request", targetType: "PAYLOAD_REQUEST", targetId: item.id, targetLabel: auditLabel(item) });
  return json(201, toPrivateRequestView(item));
}

export async function handleListOrgPayloadRequests(event, opts, orgId) {
  const { auth } = opts;
  await requireVerifiedMember(auth, orgId);
  const items = await listPayloadRequests(auth.ddb, auth.tableName);
  return json(200, { items: items.filter((item) => item.requestedBy?.orgId === orgId || item.assignedOrgId === orgId).map(toPrivateRequestView) });
}

export async function handleAssignPayloadRequest(event, opts, orgId, id) {
  const { auth } = opts;
  const org = await requireVerifiedMember(auth, orgId);
  const request = await getPayloadRequest(auth.ddb, auth.tableName, id);
  if (!request || request.status !== "open") throw err(404, "not found");
  const operatorId = validateString(bodyObject(event).operatorId, "operatorId", 1, 120);
  const operator = await getDroneOperator(auth.ddb, auth.tableName, operatorId);
  if (!operator || operator.orgId !== orgId || operator.status !== "active") throw err(400, "operator must be an active operator in this organization");
  const next = await savePayloadRequest(auth.ddb, auth.tableName, updateRequest(request, { status: "assigned", assignedOperatorId: operator.id, assignedOrgId: orgId, assignedOrgName: org.name }));
  await recordAudit(auth.ddb, auth.tableName, { ...actor(auth), action: "drone.assign", targetType: "PAYLOAD_REQUEST", targetId: id, targetLabel: auditLabel(next) });
  return json(200, toPrivateRequestView(next));
}

function validateMissionBody(body) {
  const etd = validateIso(body.etd, "etd");
  const eta = validateIso(body.eta, "eta");
  if (eta.time <= etd.time) throw err(400, "eta must be after etd");
  const permitRef = validateOptionalString(body.permitRef, "permitRef", 1, 120);
  const notamRef = validateOptionalString(body.notamRef, "notamRef", 1, 120);
  const note = validateOptionalString(body.note, "note", 1, 1000);
  return { etd: etd.value, eta: eta.value, ...(permitRef === undefined ? {} : { permitRef }), ...(notamRef === undefined ? {} : { notamRef }), ...(note === undefined ? {} : { note }) };
}

export async function handlePlanMission(event, opts, orgId, requestId) {
  const { auth } = opts;
  await requireVerifiedMember(auth, orgId);
  const request = await requireOrgRequest(auth, orgId, requestId);
  if (request.status !== "assigned" || request.assignedOrgId !== orgId || request.missionId) throw err(400, "request is not ready for mission planning");
  const operator = await getDroneOperator(auth.ddb, auth.tableName, request.assignedOperatorId);
  if (!operator || operator.orgId !== orgId || operator.status !== "active") throw err(400, "assigned operator is not active");
  const mission = await createMission(auth.ddb, auth.tableName, { ...validateMissionBody(bodyObject(event)), requestId, operatorId: operator.id, orgId, district: request.district });
  const nextRequest = await savePayloadRequest(auth.ddb, auth.tableName, updateRequest(request, { missionId: mission.id }));
  await recordAudit(auth.ddb, auth.tableName, { ...actor(auth), action: "drone.mission_plan", targetType: "MISSION", targetId: mission.id, targetLabel: auditLabel(nextRequest) });
  return json(201, toPrivateMissionView(mission));
}

async function getOrgMission(auth, orgId, id) {
  const mission = await getMission(auth.ddb, auth.tableName, id);
  if (!mission || mission.orgId !== orgId) throw err(404, "not found");
  return mission;
}

export async function handleFlownMission(event, opts, orgId, id) {
  const { auth } = opts;
  await requireVerifiedMember(auth, orgId);
  const mission = await getOrgMission(auth, orgId, id);
  if (mission.status !== "planned") throw err(400, "mission is not planned");
  const body = bodyObject(event);
  let dropPhoto;
  if (body.dropPhoto !== undefined && body.dropPhoto !== null) {
    dropPhoto = validateNeedMedia([body.dropPhoto])[0];
    if (dropPhoto.type !== "photo") throw err(400, "dropPhoto must be a photo");
  }
  const note = validateOptionalString(body.note, "note", 1, 1000);
  const flownAt = new Date().toISOString();
  const nextMission = await saveMission(auth.ddb, auth.tableName, { ...mission, status: "flown", flownAt, ...(dropPhoto ? { dropPhoto } : {}), ...(note === undefined ? {} : { note }) });
  const request = await getPayloadRequest(auth.ddb, auth.tableName, mission.requestId);
  if (!request) throw err(404, "request not found");
  const nextRequest = await savePayloadRequest(auth.ddb, auth.tableName, updateRequest(request, { status: "flown" }));
  await recordAudit(auth.ddb, auth.tableName, { ...actor(auth), action: "drone.flown", targetType: "MISSION", targetId: id, targetLabel: auditLabel(nextRequest) });
  return json(200, toPrivateMissionView(nextMission));
}

export async function handleAbortMission(event, opts, orgId, id) {
  const { auth } = opts;
  await requireVerifiedMember(auth, orgId);
  const mission = await getOrgMission(auth, orgId, id);
  if (!["planned", "flown"].includes(mission.status)) throw err(400, "mission cannot be aborted");
  const next = await saveMission(auth.ddb, auth.tableName, { ...mission, status: "aborted" });
  await recordAudit(auth.ddb, auth.tableName, { ...actor(auth), action: "drone.cancel", targetType: "MISSION", targetId: id, targetLabel: `${mission.orgId} · ${mission.district}` });
  return json(200, toPrivateMissionView(next));
}

export async function handleModerationListPayloadRequests(event, opts) {
  const { auth } = opts;
  const q = getQuery(event);
  const status = String(q.status || "open");
  if (!REQUEST_STATUSES.includes(status)) throw err(400, "invalid status");
  const items = (await listPayloadRequests(auth.ddb, auth.tableName, { status })).filter((item) => !isOutOfScope(auth.user, item.district));
  return json(200, { items: items.map(toPrivateRequestView) });
}

export async function handleConfirmPayloadRequest(event, opts, id) {
  const { auth } = opts;
  const request = await getPayloadRequest(auth.ddb, auth.tableName, id);
  if (!request) throw err(404, "not found");
  if (isOutOfScope(auth.user, request.district)) throw err(403, "out_of_scope");
  if (request.status !== "flown" || !request.missionId) throw err(400, "request is not flown");
  const mission = await getMission(auth.ddb, auth.tableName, request.missionId);
  if (!mission || mission.status !== "flown") throw err(400, "mission is not flown");
  const recipientConfirmedAt = new Date().toISOString();
  await saveMission(auth.ddb, auth.tableName, { ...mission, status: "confirmed", recipientConfirmedAt });
  const next = await savePayloadRequest(auth.ddb, auth.tableName, updateRequest(request, { status: "delivered" }));
  await recordAudit(auth.ddb, auth.tableName, { ...actor(auth), action: "drone.confirm", targetType: "PAYLOAD_REQUEST", targetId: id, targetLabel: auditLabel(next) });
  return json(200, toPrivateRequestView(next));
}

export async function handleCancelPayloadRequest(event, opts, id) {
  const { auth } = opts;
  const request = await getPayloadRequest(auth.ddb, auth.tableName, id);
  if (!request) throw err(404, "not found");
  if (isOutOfScope(auth.user, request.district)) throw err(403, "out_of_scope");
  if (["delivered", "cancelled"].includes(request.status)) throw err(400, "request cannot be cancelled");
  const next = await savePayloadRequest(auth.ddb, auth.tableName, updateRequest(request, { status: "cancelled" }));
  await recordAudit(auth.ddb, auth.tableName, { ...actor(auth), action: "drone.cancel", targetType: "PAYLOAD_REQUEST", targetId: id, targetLabel: auditLabel(next) });
  return json(200, toPrivateRequestView(next));
}

export async function handleModerationCreateLandingSite(event, opts) {
  const { auth } = opts;
  const body = bodyObject(event);
  const district = validateDistrict(body.district);
  if (isOutOfScope(auth.user, district)) throw err(403, "out_of_scope");
  const item = await createLandingSite(auth.ddb, auth.tableName, validateSiteBody(body, { kind: "moderator", sub: auth.payload.sub }));
  await recordAudit(auth.ddb, auth.tableName, { ...actor(auth), action: "drone.site_add", targetType: "LANDING_SITE", targetId: item.id, targetLabel: auditLabel(item) });
  return json(201, toPrivateSiteView(item));
}

export async function handlePublicDroneBoard(event, { getDdb, env }) {
  const q = getQuery(event);
  const ddb = getDdb();
  const requests = (await listPayloadRequests(ddb, env.TABLE_NAME, { incidentId: q.incidentId })).filter((item) => ["open", "assigned", "flown"].includes(item.status));
  const sites = await listLandingSites(ddb, env.TABLE_NAME, { status: "active" });
  const operators = await listDroneOperators(ddb, env.TABLE_NAME, { status: "active" });
  const allOperators = await listDroneOperators(ddb, env.TABLE_NAME);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const from = today.getTime() - 86400000;
  const to = today.getTime() + 2 * 86400000;
  const missions = (await listMissions(ddb, env.TABLE_NAME)).filter((mission) => {
    const etd = Date.parse(mission.etd);
    return ["planned", "flown"].includes(mission.status) && etd >= from && etd < to;
  });
  const operatorById = new Map(allOperators.map((operator) => [operator.id, operator]));
  const response = json(200, {
    requests: requests.map(toPublicRequestView), sites: sites.map(toPublicSiteView), operators: operators.map(toPublicOperatorView),
    flights: missions.map((mission) => toPublicMissionView(mission, operatorById.get(mission.operatorId))),
  });
  response.headers["cache-control"] = "public, max-age=120";
  return response;
}
