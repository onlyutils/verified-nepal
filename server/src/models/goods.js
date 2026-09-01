import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { unitFor } from "../lib/goods-taxonomy.js";

export async function putEntry(ddb, tableName, entry) {
  await ddb.send(new PutCommand({ TableName: tableName, Item: entry }));
  const ptr = {
    PK: `ENTRY#${entry.id}`,
    SK: "META",
    type: "ENTRYPTR",
    centerId: entry.centerId,
    SKref: entry.SK,
  };
  await ddb.send(new PutCommand({ TableName: tableName, Item: ptr }));
}

export async function getEntryById(ddb, tableName, entryId) {
  const ptrRes = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `ENTRY#${entryId}`, SK: "META" } }));
  const ptr = ptrRes.Item;
  if (!ptr) return null;
  const centerId = ptr.centerId;
  const sk = ptr.SKref;
  if (!centerId || !sk) return null;
  const res = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `GOODS#${centerId}`, SK: sk } }));
  return res.Item || null;
}

export async function putTransferMeta(ddb, tableName, meta) {
  await ddb.send(new PutCommand({ TableName: tableName, Item: meta }));
}

export async function getTransferMeta(ddb, tableName, transferId) {
  const res = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `TRANSFER#${transferId}`, SK: "META" } }));
  return res.Item || null;
}

export async function putInbound(ddb, tableName, destCenterId, inbound) {
  await ddb.send(new PutCommand({ TableName: tableName, Item: inbound }));
}

export async function deleteInbound(ddb, tableName, destCenterId, transferId) {
  await ddb.send(new DeleteCommand({ TableName: tableName, Key: { PK: `CENTER#${destCenterId}`, SK: `INBOUND#${transferId}` } }));
}

export async function listInbound(ddb, tableName, centerId) {
  const res = await ddb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": `CENTER#${centerId}`, ":prefix": "INBOUND#" },
  }));
  return res.Items || [];
}

export async function getInbound(ddb, tableName, destCenterId, transferId) {
  const res = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `CENTER#${destCenterId}`, SK: `INBOUND#${transferId}` } }));
  return res.Item || null;
}

export async function listEntries(ddb, tableName, centerId, cursorKey, limit = 50) {
  const res = await ddb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: { ":pk": `GOODS#${centerId}` },
    ScanIndexForward: false,
    Limit: limit,
    ...(cursorKey ? { ExclusiveStartKey: cursorKey } : {}),
  }));
  return res;
}

export async function listAllEntries(ddb, tableName, centerId) {
  let all = [];
  let cursorKey = null;
  while (true) {
    const res = await listEntries(ddb, tableName, centerId, cursorKey, 100);
    const items = res.Items || [];
    all.push(...items);
    if (!res.LastEvaluatedKey) break;
    cursorKey = res.LastEvaluatedKey;
  }
  return all;
}

export async function listDistrictEntries(ddb, tableName, district, cursorKey) {
  const res = await ddb.send(new QueryCommand({
    TableName: tableName,
    IndexName: "GSI1",
    KeyConditionExpression: "gsi1pk = :pk",
    ExpressionAttributeValues: { ":pk": `GOODS#${district}` },
    ScanIndexForward: false,
    Limit: 50,
    ...(cursorKey ? { ExclusiveStartKey: cursorKey } : {}),
  }));
  return res;
}

export function computeStock(entries) {
  const map = new Map();
  for (const e of entries) {
    const cat = e.category;
    const delta = e.delta ?? 0;
    map.set(cat, (map.get(cat) || 0) + delta);
  }
  const out = [];
  for (const [category, qty] of map.entries()) {
    if (qty === 0) continue;
    const unit = unitFor(category) || "piece";
    const rounded = Math.round(qty * 100) / 100;
    out.push({ category, unit, qty: rounded });
  }
  out.sort((a, b) => a.category.localeCompare(b.category));
  return out;
}

export function deltaFor(entryType, qty) {
  if (entryType === "intake" || entryType === "transfer_in") return qty;
  if (entryType === "distribution" || entryType === "transfer_out") return -qty;
  if (entryType === "correction") return -qty;
  return qty;
}
