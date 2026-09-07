import { json, err, getQuery, parseBody } from "../lib/http.js";
import { validateOptionalString, validateString } from "../lib/validate.js";
import { getOrg, getMembership, listOrgMembers } from "../models/org.js";
import { listOrgNeeds } from "../models/orgNeed.js";
import { getNeedById } from "../models/need.js";
import {
  createAssignment, getAssignment, listAssignments, saveAssignment,
  createActivity, listActivities,
} from "../models/assignment.js";
import { recordAudit } from "../models/audit.js";
import { toAssignmentView, toActivityView, toHandoverView, toHandoverCsv } from "../views/assignment.js";

const SHIFTS = ["day", "night"];
const STATUSES = ["assigned", "en_route", "on_site", "done", "cancelled"];
const STATUS_LABELS = { assigned: "assigned", en_route: "en route", on_site: "on site", done: "done", cancelled: "cancelled" };
const STATUS_ORDER = { assigned: 0, en_route: 1, on_site: 2, done: 3 };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function validateDate(value, name = "date") {
  if (typeof value !== "string" || !DATE_RE.test(value)) throw err(400, `${name} must be YYYY-MM-DD`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw err(400, `${name} must be YYYY-MM-DD`);
  return value;
}

function bodyObject(event) {
  const body = parseBody(event);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw err(400, "invalid body");
  return body;
}

function actor(auth) {
  return { bySub: auth.payload.sub, byName: auth.user?.name || auth.payload.name || "" };
}

async function requireOrgMember(auth, orgId) {
  const org = await getOrg(auth.ddb, auth.tableName, orgId);
  if (!org) throw err(404, "not found");
  const membership = await getMembership(auth.ddb, auth.tableName, auth.payload.sub, orgId);
  if (!membership || !["owner", "staff"].includes(membership.role)) throw err(403, "Forbidden");
  return { org, membership };
}

function validateTarget(body) {
  const keys = ["needId", "distributionId", "siteLabel"];
  const present = keys.filter((key) => body[key] !== undefined && body[key] !== null && body[key] !== "");
  if (present.length !== 1) throw err(400, "exactly one of needId, distributionId, or siteLabel is required");
  const key = present[0];
  return { [key]: key === "siteLabel" ? validateString(body[key], key, 1, 120) : validateString(body[key], key, 1, 200) };
}

async function validateAssignmentBody(body, auth, orgId) {
  const shiftDate = validateDate(body.shiftDate, "shiftDate");
  const shift = validateString(body.shift, "shift", 1, 10);
  if (!SHIFTS.includes(shift)) throw err(400, "shift must be day or night");
  const assigneeSub = validateString(body.assigneeSub, "assigneeSub", 1, 200);
  const members = await listOrgMembers(auth.ddb, auth.tableName, orgId);
  const assignee = members.find((member) => member.sub === assigneeSub && ["owner", "staff"].includes(member.role));
  if (!assignee) throw err(400, "assignee must be an organization member");
  const task = validateString(body.task, "task", 1, 300);
  return {
    shiftDate,
    shift,
    assigneeSub,
    assigneeName: assignee.name || (assigneeSub === auth.payload.sub ? auth.user?.name || auth.payload.name || "" : ""),
    ...validateTarget(body),
    task,
  };
}

async function appendActivity(auth, orgId, fields) {
  const at = new Date().toISOString();
  return createActivity(auth.ddb, auth.tableName, { orgId, at, ...actor(auth), ...fields });
}

export async function handleCreateAssignment(event, opts, orgId) {
  const { auth } = opts;
  await requireOrgMember(auth, orgId);
  const body = bodyObject(event);
  const fields = await validateAssignmentBody(body, auth, orgId);
  const item = await createAssignment(auth.ddb, auth.tableName, {
    ...fields,
    orgId,
    createdBy: auth.payload.sub,
  });
  await recordAudit(auth.ddb, auth.tableName, {
    actorSub: auth.payload.sub,
    actorName: auth.user?.name || auth.payload.name || "",
    action: "org.assign",
    targetType: "ASSIGNMENT",
    targetId: item.id,
    targetLabel: `${item.assigneeName}: ${item.task}`.slice(0, 200),
  });
  return json(201, toAssignmentView(item));
}

export async function handleListAssignments(event, opts, orgId) {
  const { auth } = opts;
  await requireOrgMember(auth, orgId);
  const date = validateDate(getQuery(event).date || todayUtc());
  const items = await listAssignments(auth.ddb, auth.tableName, orgId, date);
  return json(200, { date, items: items.map(toAssignmentView) });
}

export async function handleAssignmentStatus(event, opts, orgId, id) {
  const { auth } = opts;
  await requireOrgMember(auth, orgId);
  const assignment = await getAssignment(auth.ddb, auth.tableName, orgId, id);
  if (!assignment) throw err(404, "not found");
  const membership = await getMembership(auth.ddb, auth.tableName, auth.payload.sub, orgId);
  if (membership.role !== "owner" && assignment.assigneeSub !== auth.payload.sub) throw err(403, "Forbidden");
  const body = bodyObject(event);
  const status = validateString(body.status, "status", 1, 20);
  if (!STATUSES.includes(status)) throw err(400, "status is invalid");
  if (status === assignment.status || (assignment.status === "cancelled" && status !== "cancelled") || (status !== "cancelled" && STATUS_ORDER[status] <= STATUS_ORDER[assignment.status])) {
    throw err(400, "status must move forward");
  }
  const updated = {
    ...assignment,
    status,
    statusAt: new Date().toISOString(),
  };
  await saveAssignment(auth.ddb, auth.tableName, updated, assignment.status);
  await appendActivity(auth, orgId, {
    text: `${assignment.assigneeName}: ${assignment.task} → ${STATUS_LABELS[status]}`.slice(0, 500),
    ...(assignment.needId ? { needId: assignment.needId } : {}),
    assignmentId: assignment.id,
  });
  return json(200, toAssignmentView(updated));
}

export async function handleCreateLog(event, opts, orgId) {
  const { auth } = opts;
  await requireOrgMember(auth, orgId);
  const body = bodyObject(event);
  const text = validateString(body.text, "text", 1, 500);
  const needId = validateOptionalString(body.needId, "needId", 1, 200);
  const assignmentId = validateOptionalString(body.assignmentId, "assignmentId", 1, 200);
  const item = await appendActivity(auth, orgId, {
    text,
    ...(needId === undefined ? {} : { needId }),
    ...(assignmentId === undefined ? {} : { assignmentId }),
  });
  return json(201, toActivityView(item));
}

export async function handleListLog(event, opts, orgId) {
  const { auth } = opts;
  await requireOrgMember(auth, orgId);
  const date = validateDate(getQuery(event).date || todayUtc());
  const items = await listActivities(auth.ddb, auth.tableName, orgId, date);
  return json(200, { date, items: items.map(toActivityView) });
}

async function listOpenNeeds(auth, orgId) {
  const needs = [];
  for (const pointer of await listOrgNeeds(auth.ddb, auth.tableName, orgId)) {
    const need = await getNeedById(auth.ddb, auth.tableName, pointer.needId);
    if (need?.status === "matched") needs.push(need);
  }
  return needs;
}

export async function handleHandover(event, opts, orgId) {
  const { auth } = opts;
  const { org } = await requireOrgMember(auth, orgId);
  const query = getQuery(event);
  const date = validateDate(query.date || todayUtc());
  const shift = validateString(query.shift, "shift", 1, 10);
  if (!SHIFTS.includes(shift)) throw err(400, "shift must be day or night");
  const assignments = (await listAssignments(auth.ddb, auth.tableName, orgId, date)).filter((item) => item.shift === shift);
  const activities = await listActivities(auth.ddb, auth.tableName, orgId, date);
  const openNeeds = await listOpenNeeds(auth, orgId);
  const handover = toHandoverView({ org, date, shift, assignments, activities, openNeeds, generatedAt: new Date().toISOString() });
  if (String(query.format || "").toLowerCase() === "csv") {
    return {
      statusCode: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename=verifiednepal-handover-${date}-${shift}.csv`,
      },
      body: toHandoverCsv({ assignments, activities }),
    };
  }
  return json(200, handover);
}
