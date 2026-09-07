import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { json, err, parseBody } from "../lib/http.js";
import { maskName } from "../lib/format.js";
import { getNeedById, setNeedStatus, countActiveHelperTakes } from "../models/need.js";
import { deleteHandlingPointer, putHandlingPointer } from "../models/mine.js";
import { fulfilNeed } from "../models/claim.js";
import { deleteOrgNeed } from "../models/orgNeed.js";
import { recordAudit, getTargetLabelForAudit } from "../models/audit.js";
import { toHandlingContact } from "../views/mine.js";

function actorLabel(auth) {
  return maskName(auth.user?.name || auth.payload.name || "") || "Helper";
}

function auditActor(auth) {
  const label = actorLabel(auth);
  return { actorSub: auth.payload.sub, actorName: label };
}

async function loadNeed(auth, needId) {
  const need = await getNeedById(auth.ddb, auth.tableName, needId);
  if (!need) throw err(404, "not found");
  return need;
}

function requireTakeable(need) {
  if (need.assignOnly) throw err(403, "assign_only");
  if (need.status !== "published" || need.handledBy) throw err(409, "need_not_available");
}

function contactFor(need) {
  return toHandlingContact(need);
}

async function setContactViewed(auth, need) {
  const viewedAt = new Date().toISOString();
  try {
    await auth.ddb.send(new UpdateCommand({
      TableName: auth.tableName,
      Key: { PK: need.PK, SK: need.SK },
      UpdateExpression: "SET contactViewedBy = if_not_exists(contactViewedBy, :empty)",
      ExpressionAttributeValues: { ":empty": {} },
    }));
    await auth.ddb.send(new UpdateCommand({
      TableName: auth.tableName,
      Key: { PK: need.PK, SK: need.SK },
      UpdateExpression: "SET contactViewedBy.#sub = :viewedAt",
      ConditionExpression: "attribute_not_exists(contactViewedBy.#sub)",
      ExpressionAttributeNames: { "#sub": auth.payload.sub },
      ExpressionAttributeValues: { ":viewedAt": viewedAt },
    }));
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") return;
    console.error("Could not record need contact view", { needId: need.id, sub: auth.payload.sub, error: e });
    return;
  }
  try {
    await recordAudit(auth.ddb, auth.tableName, { ...auditActor(auth), action: "need.contact_view", targetType: "NEED", targetId: need.id, targetLabel: getTargetLabelForAudit("NEED", need) });
  } catch (e) {
    console.error("Could not record need contact view audit", { needId: need.id, sub: auth.payload.sub, error: e });
  }
}

export async function handleHelperTakeNeed(event, opts, needId) {
  const { auth } = opts;
  const need = await loadNeed(auth, needId);
  requireTakeable(need);
  if (await countActiveHelperTakes(auth.ddb, auth.tableName, auth.payload.sub) >= 3) throw err(409, "take_limit");
  const label = actorLabel(auth);
  const at = new Date().toISOString();
  need.handledBy = { kind: "helper", sub: auth.payload.sub, label, at };
  need.contactViewedBy ||= {};
  try {
    await setNeedStatus(auth.ddb, auth.tableName, { need, status: "matched", expectedStatus: "published" });
  } catch (e) {
    if (e.status === 409) throw err(409, "need_not_available");
    throw e;
  }
  await putHandlingPointer(auth.ddb, auth.tableName, { sub: auth.payload.sub, needId });
  await recordAudit(auth.ddb, auth.tableName, { ...auditActor(auth), action: "need.take", targetType: "NEED", targetId: need.id, targetLabel: getTargetLabelForAudit("NEED", need) });
  return json(200, { status: "matched", handler: label });
}

async function requireHelperTake(auth, needId) {
  const need = await loadNeed(auth, needId);
  if (need.status !== "matched" || need.handledBy?.kind !== "helper" || need.handledBy.sub !== auth.payload.sub) throw err(409, "need_not_handled_by_helper");
  return need;
}

export async function handleHelperReleaseNeed(event, opts, needId) {
  const { auth } = opts;
  const need = await requireHelperTake(auth, needId);
  delete need.handledBy;
  await setNeedStatus(auth.ddb, auth.tableName, { need, status: "published", expectedStatus: "matched" }).catch((e) => {
    if (e.status === 409) throw err(409, "need_not_handled_by_helper");
    throw e;
  });
  await deleteHandlingPointer(auth.ddb, auth.tableName, { sub: auth.payload.sub, needId });
  await recordAudit(auth.ddb, auth.tableName, { ...auditActor(auth), action: "need.release", targetType: "NEED", targetId: need.id, targetLabel: getTargetLabelForAudit("NEED", need) });
  return json(200, { status: "published" });
}

export async function handleHelperDeliverNeed(event, opts, needId) {
  const { auth } = opts;
  const need = await requireHelperTake(auth, needId);
  const body = parseBody(event) || {};
  if (body.note !== undefined && body.note !== null && typeof body.note !== "string") throw err(400, "note must be string");
  const label = need.handledBy.label;
  const at = await fulfilNeed(auth.ddb, auth.tableName, {
    need, note: body.note, ...auditActor(auth), reason: `helper:${label}`, auditAction: "need.deliver",
    deliveredBy: { kind: "helper", label, ref: auth.payload.sub }, expectedStatus: "matched",
  }).catch((e) => {
    if (e.status === 409) throw err(409, "need_not_handled_by_helper");
    throw e;
  });
  await deleteHandlingPointer(auth.ddb, auth.tableName, { sub: auth.payload.sub, needId });
  return json(200, { status: "fulfilled", redeemedAt: at });
}

export async function handleGroupTakeNeed(event, opts, needId) {
  const { auth } = opts;
  const need = await loadNeed(auth, needId);
  requireTakeable(need);
  if (!need.group || !need.groupMembers?.[auth.payload.sub]) throw err(403, "not_a_member");
  const groupId = need.id;
  const label = `Helper group (${Object.keys(need.groupMembers || {}).length})`;
  const at = new Date().toISOString();
  need.handledBy = { kind: "group", groupId, label, at };
  need.contactViewedBy ||= {};
  try {
    await setNeedStatus(auth.ddb, auth.tableName, { need, status: "matched", expectedStatus: "published" });
  } catch (e) {
    if (e.status === 409) throw err(409, "need_not_available");
    throw e;
  }
  await recordAudit(auth.ddb, auth.tableName, { ...auditActor(auth), action: "need.take", targetType: "NEED", targetId: need.id, targetLabel: getTargetLabelForAudit("NEED", need), reason: label });
  return json(200, { status: "matched", handler: label });
}

async function requireGroupTake(auth, needId) {
  const need = await loadNeed(auth, needId);
  if (need.status !== "matched" || need.handledBy?.kind !== "group" || !need.groupMembers?.[auth.payload.sub]) throw err(409, "need_not_handled_by_group");
  return need;
}

export async function handleGroupReleaseNeed(event, opts, needId) {
  const { auth } = opts;
  const need = await requireGroupTake(auth, needId);
  delete need.handledBy;
  await setNeedStatus(auth.ddb, auth.tableName, { need, status: "published", expectedStatus: "matched" }).catch((e) => {
    if (e.status === 409) throw err(409, "need_not_handled_by_group");
    throw e;
  });
  await recordAudit(auth.ddb, auth.tableName, { ...auditActor(auth), action: "need.release", targetType: "NEED", targetId: need.id, targetLabel: getTargetLabelForAudit("NEED", need) });
  return json(200, { status: "published" });
}

export async function handleGroupDeliverNeed(event, opts, needId) {
  const { auth } = opts;
  const need = await requireGroupTake(auth, needId);
  const body = parseBody(event) || {};
  if (body.note !== undefined && body.note !== null && typeof body.note !== "string") throw err(400, "note must be string");
  const label = need.handledBy.label;
  const at = await fulfilNeed(auth.ddb, auth.tableName, {
    need, note: body.note, ...auditActor(auth), reason: `group:${need.handledBy.groupId}`, auditAction: "need.deliver",
    deliveredBy: { kind: "group", label, ref: need.handledBy.groupId }, expectedStatus: "matched",
  }).catch((e) => {
    if (e.status === 409) throw err(409, "need_not_handled_by_group");
    throw e;
  });
  return json(200, { status: "fulfilled", redeemedAt: at });
}

export async function handleGetNeedContact(event, opts, needId) {
  const { auth } = opts;
  const need = await loadNeed(auth, needId);
  const isHelper = need.handledBy?.kind === "helper" && need.handledBy.sub === auth.payload.sub;
  const isGroupMember = need.handledBy?.kind === "group" && Boolean(need.groupMembers?.[auth.payload.sub]);
  if (!isHelper && !isGroupMember) throw err(403, "not_need_handler");
  await setContactViewed(auth, need);
  return json(200, contactFor(need));
}

export async function handleModeratorReleaseNeed(event, opts, needId) {
  const { auth } = opts;
  const need = await loadNeed(auth, needId);
  if (need.status !== "matched" || !need.handledBy) throw err(409, "need_not_handled");
  const previousHandler = need.handledBy;
  const previous = previousHandler.label || previousHandler.orgName || "";
  delete need.handledBy;
  await setNeedStatus(auth.ddb, auth.tableName, { need, status: "published", expectedStatus: "matched" });
  if (previousHandler.kind === "org" || previousHandler.orgId) {
    await deleteOrgNeed(auth.ddb, auth.tableName, { orgId: previousHandler.orgId, needId });
  }
  await recordAudit(auth.ddb, auth.tableName, { actorSub: auth.payload.sub, actorName: auth.user?.name || auth.payload.name || "", action: "need.release", targetType: "NEED", targetId: need.id, targetLabel: getTargetLabelForAudit("NEED", need), reason: `moderator release: ${previous}` });
  return json(200, { status: "published" });
}

export async function handleReleaseNeed(event, opts, needId) {
  if (["moderator", "admin"].includes(opts.auth.role)) return handleModeratorReleaseNeed(event, opts, needId);
  return handleHelperReleaseNeed(event, opts, needId);
}
