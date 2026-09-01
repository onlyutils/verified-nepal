import { randomUUID } from "node:crypto";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { maskName, maskEmail } from "../lib/format.js";

export function getNeedTargetLabel(need) {
  const masked = maskName(need?.beneficiary?.name || need?.name || "");
  const ward = need?.beneficiary?.ward ?? need?.ward;
  if (ward !== undefined && ward !== null) return `${masked}, Ward ${ward}`;
  return masked;
}

export function getTargetLabelForAudit(targetType, item) {
  if (!item) return "";
  if (targetType === "NEED") return getNeedTargetLabel(item);
  if (targetType === "OFFER") {
    const helper = item.helperLabel || maskName(item.helperName || "");
    return helper;
  }
  if (targetType === "PROJECT") {
    const t = item.title;
    if (t && typeof t === "object") return (t.en || t.ne || "").slice(0, 200);
    if (typeof t === "string") return t.slice(0, 200);
    return item.id || "";
  }
  if (targetType === "DISPATCH") {
    const t = item.title;
    if (t && typeof t === "object") return (t.en || t.ne || "").slice(0, 200);
    if (typeof t === "string") return t.slice(0, 200);
    return item.id || "";
  }
  if (targetType === "USER") {
    return maskEmail(item.email || "");
  }
  if (targetType === "UPDATE") {
    return (item.text || "").slice(0, 80);
  }
  return String(item.id || item.PK || "").slice(0, 200);
}

export function buildAuditEntry({ actorSub, actorName, action, targetType, targetId, targetLabel, reason, ts }) {
  const ym = ts.slice(0, 7);
  const entry = {
    PK: `AUDIT#${ym}`,
    SK: `${ts}#${actorSub}#${randomUUID().slice(0, 6)}`,
    type: "AUDIT",
    actorSub,
    actorName: actorName || "",
    action,
    targetType,
    targetId,
    targetLabel: targetLabel || "",
    ts,
    createdAt: ts,
  };
  if (reason) entry.reason = String(reason).trim();
  return entry;
}

export async function writeAudit(ddb, tableName, entry) {
  await ddb.send(new PutCommand({ TableName: tableName, Item: entry }));
}

export async function recordAudit(ddb, tableName, { actorSub, actorName, action, targetType, targetId, targetLabel, reason }) {
  const ts = new Date().toISOString();
  const entry = buildAuditEntry({ actorSub, actorName, action, targetType, targetId, targetLabel, reason, ts });
  await writeAudit(ddb, tableName, entry);
  return entry;
}

export async function listAuditByMonth(ddb, tableName, monthRaw, cursorKey) {
  const pk = `AUDIT#${monthRaw}`;
  return ddb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: { ":pk": pk },
    ScanIndexForward: false,
    ...(cursorKey ? { ExclusiveStartKey: cursorKey } : {}),
    Limit: 20,
  }));
}
