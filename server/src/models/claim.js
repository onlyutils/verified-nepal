import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { err } from "../lib/http.js";
import { maskName } from "../lib/format.js";
import { isOutOfScope } from "../lib/auth.js";
import { recordAudit, getTargetLabelForAudit } from "./audit.js";

export async function performRedeem(ddb, tableName, { claimCode, providedRedeemedAt, note, user, actorSub, actorName }) {
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
  const redeemedAt = await fulfilNeed(ddb, tableName, { need, redeemedAt: providedRedeemedAt, note, actorSub, actorName, reason: "redeem" });
  return { status: "redeemed", needId, redeemedAt };
}

/**
 * The one place a need becomes "fulfilled": status + GSI keys, public ledger rows, audit.
 * Used by the moderator claim-code redeem and by organizations marking a need delivered.
 */
export async function fulfilNeed(ddb, tableName, { need, redeemedAt, note, actorSub, actorName, reason, orgName }) {
  const at = redeemedAt || new Date().toISOString();
  const district = need.beneficiary?.district || need.district || "";
  const ward = need.beneficiary?.ward ?? need.ward;
  if (!district || ward === undefined) throw err(500, "need missing district/ward");
  need.status = "fulfilled";
  need.redeemedAt = at;
  need.gsi1pk = `NEED#${district}#fulfilled`;
  need.gsi1sk = need.createdAt;
  need.gsi2pk = "NEED#fulfilled";
  need.gsi2sk = need.createdAt;
  await ddb.send(new PutCommand({ TableName: tableName, Item: need }));
  const ledgerBase = { type: "LEDGER", needId: need.id, claimCode: need.claimCode, maskedName: maskName(need.beneficiary?.name || ""), category: need.category, district, ward, redeemedAt: at };
  if (orgName) ledgerBase.orgName = orgName;
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

export async function queryLedger(ddb, tableName, pk) {
  const res = await ddb.send(new QueryCommand({ TableName: tableName, KeyConditionExpression: "PK = :pk", ExpressionAttributeValues: { ":pk": pk }, ScanIndexForward: false }));
  return res.Items || [];
}
