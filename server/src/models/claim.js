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
  const redeemedAt = providedRedeemedAt || new Date().toISOString();
  if (providedRedeemedAt) {
    const d = new Date(providedRedeemedAt);
    if (Number.isNaN(d.getTime())) throw err(400, "redeemedAt must be valid ISO datetime");
  }
  const district = need.beneficiary?.district || need.district || "";
  const ward = need.beneficiary?.ward ?? need.ward;
  if (!district || ward === undefined) throw err(500, "need missing district/ward");
  need.status = "fulfilled";
  need.redeemedAt = redeemedAt;
  need.gsi1pk = `NEED#${need.incidentId}#${district}#fulfilled`;
  need.gsi1sk = need.createdAt;
  need.gsi2pk = "NEED#fulfilled";
  need.gsi2sk = need.createdAt;
  await ddb.send(new PutCommand({ TableName: tableName, Item: need }));
  const masked = maskName(need.beneficiary?.name || "");
  const ledgerBase = { type: "LEDGER", needId, claimCode, maskedName: masked, category: need.category, district, ward, redeemedAt };
  if (note !== undefined && note !== null && String(note).trim() !== "") {
    const n = String(note).trim();
    if (n.length > 500) throw err(400, "note too long");
    ledgerBase.note = n;
  }
  const item1 = { PK: `LEDGER#${district}#${ward}`, SK: `${redeemedAt}#${needId}`, ...ledgerBase };
  const item2 = { PK: `LEDGER#${district}`, SK: `${redeemedAt}#${needId}`, ...ledgerBase };
  await ddb.send(new PutCommand({ TableName: tableName, Item: item1 }));
  await ddb.send(new PutCommand({ TableName: tableName, Item: item2 }));
  const targetLabel = getTargetLabelForAudit("NEED", need);
  await recordAudit(ddb, tableName, { actorSub, actorName, action: "redeem", targetType: "NEED", targetId: needId, targetLabel, reason: "redeem" });
  return { status: "redeemed", needId, redeemedAt };
}

export async function queryLedger(ddb, tableName, pk) {
  const res = await ddb.send(new QueryCommand({ TableName: tableName, KeyConditionExpression: "PK = :pk", ExpressionAttributeValues: { ":pk": pk }, ScanIndexForward: false }));
  return res.Items || [];
}
