import { GetCommand, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { err } from "../lib/http.js";
import { maskName } from "../lib/format.js";
import { isOutOfScope } from "../lib/auth.js";
import { recordAudit, getTargetLabelForAudit } from "./audit.js";

export const DELIVERED_BY_KINDS = ["org", "helper", "group", "field"];

function containsPii(label, actorSub) {
  return /\S+@\S+\.\S+/.test(label) || /\+?\d[\d\s().-]{5,}\d/.test(label) || (actorSub && String(actorSub).length >= 4 && label.includes(actorSub));
}

export function validateDeliveredBy(value, actorSub) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw err(400, "deliveredBy must be an object");
  if (!DELIVERED_BY_KINDS.includes(value.kind)) throw err(400, "deliveredBy.kind must be org, helper, group, or field");
  if (typeof value.label !== "string") throw err(400, "deliveredBy.label must be string");
  const label = value.label.trim();
  if (!label) throw err(400, "deliveredBy.label required");
  if (label.length > 80) throw err(400, "deliveredBy.label too long");
  if (containsPii(label, actorSub)) throw err(400, "deliveredBy.label must not contain contact or account identifiers");
  return { kind: value.kind, label };
}

export async function deriveDeliveredBy(ddb, tableName, need) {
  if (need.handledBy?.orgName) return { kind: "org", label: need.handledBy.orgName };
  if (need.matchedOfferId) {
    const offer = (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `OFFER#${need.matchedOfferId}`, SK: "META" } }))).Item;
    if (offer) return { kind: "helper", label: maskName(offer.helperLabel || offer.helperName || ""), ref: need.matchedOfferId };
  }
  if (need.group) {
    return { kind: "group", label: `Helper group (${Object.keys(need.groupMembers || {}).length})` };
  }
  return { kind: "field", label: "Claim code · moderator" };
}

export async function performRedeem(ddb, tableName, { claimCode, providedRedeemedAt, note, user, actorSub, actorName, deliveredBy }) {
  const claim = (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `CLAIM#${claimCode}`, SK: "META" } }))).Item;
  if (!claim) return { status: "unknown" };
  const needId = claim.needId;
  const need = (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `NEED#${needId}`, SK: "META" } }))).Item;
  if (!need) return { status: "unknown" };
  if (isOutOfScope(user, need)) throw err(403, "out_of_scope");
  if (need.redeemedAt) {
    return { status: "already_redeemed", needId, redeemedAt: need.redeemedAt };
  }
  if (providedRedeemedAt && Number.isNaN(new Date(providedRedeemedAt).getTime())) throw err(400, "redeemedAt must be valid ISO datetime");
  const redeemedAt = await fulfilNeed(ddb, tableName, { need, redeemedAt: providedRedeemedAt, note, actorSub, actorName, reason: "redeem", expectedStatus: need.status, deliveredBy });
  return { status: "redeemed", needId, redeemedAt };
}

/**
 * The one place a need becomes "fulfilled": status + GSI keys, public ledger rows, audit.
 * Used by the moderator claim-code redeem and by organizations marking a need delivered.
 */
export async function fulfilNeed(ddb, tableName, { need, redeemedAt, note, actorSub, actorName, reason, orgName, deliveredBy, expectedStatus }) {
  const at = redeemedAt || new Date().toISOString();
  const district = need.beneficiary?.district || need.district || "";
  const ward = need.beneficiary?.ward ?? need.ward;
  if (!district || ward === undefined) throw err(500, "need missing district/ward");
  const attribution = deliveredBy || (orgName ? { kind: "org", label: orgName } : await deriveDeliveredBy(ddb, tableName, need));
  need.status = "fulfilled";
  need.redeemedAt = at;
  need.deliveredBy = attribution;
  need.gsi1pk = `NEED#${need.incidentId}#${district}#fulfilled`;
  need.gsi1sk = need.createdAt;
  need.gsi2pk = "NEED#fulfilled";
  need.gsi2sk = need.createdAt;
  const params = { TableName: tableName, Item: need };
  if (expectedStatus !== undefined) {
    params.ConditionExpression = "#status = :expectedStatus";
    params.ExpressionAttributeNames = { "#status": "status" };
    params.ExpressionAttributeValues = { ":expectedStatus": expectedStatus };
  }
  try {
    await ddb.send(new PutCommand(params));
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") throw err(409, "need_status_changed");
    throw e;
  }
  const ledgerBase = { type: "LEDGER", needId: need.id, claimCode: need.claimCode, maskedName: maskName(need.beneficiary?.name || ""), category: need.category, district, ward, redeemedAt: at, deliveredBy: attribution };
  if (orgName || attribution.kind === "org") ledgerBase.orgName = orgName || attribution.label;
  if (note !== undefined && note !== null && String(note).trim() !== "") {
    const n = String(note).trim();
    if (n.length > 500) throw err(400, "note too long");
    ledgerBase.note = n;
  }
  await ddb.send(new PutCommand({ TableName: tableName, Item: { PK: `LEDGER#${district}#${ward}`, SK: `${at}#${need.id}`, ...ledgerBase } }));
  await ddb.send(new PutCommand({ TableName: tableName, Item: { PK: `LEDGER#${district}`, SK: `${at}#${need.id}`, ...ledgerBase } }));
  await recordAudit(ddb, tableName, { actorSub, actorName, action: "redeem", targetType: "NEED", targetId: need.id, targetLabel: getTargetLabelForAudit("NEED", need), reason });
  return at;
}

export async function queryLedger(ddb, tableName, pk, cursorKey) {
  return ddb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: { ":pk": pk },
    ScanIndexForward: false,
    Limit: 200,
    ...(cursorKey ? { ExclusiveStartKey: cursorKey } : {}),
  }));
}

export async function scanAllLedger(ddb, tableName, cursorKey) {
  return ddb.send(new ScanCommand({
    TableName: tableName,
    FilterExpression: "begins_with(PK, :prefix)",
    ExpressionAttributeValues: { ":prefix": "LEDGER#" },
    Limit: 200,
    ...(cursorKey ? { ExclusiveStartKey: cursorKey } : {}),
  }));
}
