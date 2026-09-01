import { randomUUID } from "node:crypto";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { err } from "../lib/http.js";
import { buildAuditEntry, writeAudit, getTargetLabelForAudit } from "./audit.js";

export async function createDispatch(ddb, tableName, { titleObj, bodyObj, displayName, place, email, uniqueTags, language }) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const status = "pending";
  const item = {
    PK: `DISPATCH#${id}`,
    SK: "META",
    type: "DISPATCH",
    id,
    title: titleObj,
    body: bodyObj,
    author: { displayName, place, email },
    tags: uniqueTags,
    language,
    status,
    createdAt,
    gsi2pk: `DISPATCH#${status}`,
    gsi2sk: createdAt,
  };
  if (!item.author.place) delete item.author.place;
  await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
  return { id };
}

export async function queryPublishedDispatchesPage(ddb, tableName, { tagRaw, cursorKey }) {
  const limit = 20;
  const basePk = "DISPATCH#published";
  let ExclusiveStartKey = cursorKey;
  let collected = [];
  let lastEvaluatedKey = null;
  let done = false;
  while (!done) {
    const res = await ddb.send(new QueryCommand({
      TableName: tableName,
      IndexName: "GSI2",
      KeyConditionExpression: "gsi2pk = :pk",
      ExpressionAttributeValues: { ":pk": basePk },
      ScanIndexForward: false,
      Limit: limit,
      ...(ExclusiveStartKey ? { ExclusiveStartKey } : {}),
    }));
    let items = res.Items || [];
    if (tagRaw) items = items.filter((it) => Array.isArray(it.tags) && it.tags.includes(tagRaw));
    collected.push(...items);
    lastEvaluatedKey = res.LastEvaluatedKey || null;
    if (collected.length >= limit) {
      done = true;
    } else if (!lastEvaluatedKey) {
      done = true;
    } else {
      ExclusiveStartKey = lastEvaluatedKey;
      if (tagRaw) {
        continue;
      } else {
        done = collected.length >= limit || !lastEvaluatedKey;
        if (!done) ExclusiveStartKey = lastEvaluatedKey;
      }
    }
    if (collected.length >= limit) done = true;
    if (!lastEvaluatedKey) done = true;
    if (done) break;
    if (!tagRaw) break;
  }
  let sliced = collected.slice(0, limit);
  let hasMore = false;
  if (collected.length > limit) hasMore = true;
  else if (lastEvaluatedKey) {
    hasMore = true;
  } else if (collected.length === limit) {
    hasMore = false;
  }
  if (!tagRaw) {
    hasMore = !!lastEvaluatedKey;
  } else {
    hasMore = sliced.length === limit && (!!lastEvaluatedKey || collected.length > limit);
    if (collected.length > limit) hasMore = true;
  }
  return { sliced, hasMore, lastEvaluatedKey };
}

export async function getDispatchById(ddb, tableName, id) {
  return (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `DISPATCH#${id}`, SK: "META" } }))).Item;
}

export async function listPendingDispatches(ddb, tableName) {
  const res = await ddb.send(new QueryCommand({ TableName: tableName, IndexName: "GSI2", KeyConditionExpression: "gsi2pk = :pk", ExpressionAttributeValues: { ":pk": "DISPATCH#pending" }, ScanIndexForward: true }));
  let items = res.Items || [];
  items.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  return items;
}

export async function moderateDispatch(ddb, tableName, { item, action, reason, actorSub, actorName }) {
  const nowIso = new Date().toISOString();
  if (action === "publish") {
    item.status = "published";
    item.publishedAt = nowIso;
    item.gsi2pk = "DISPATCH#published";
    item.gsi2sk = nowIso;
    await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
  } else {
    item.status = "rejected";
    item.gsi2pk = "DISPATCH#rejected";
    item.gsi2sk = item.createdAt;
    if (reason && typeof reason === "string" && reason.trim()) item.rejectionReason = reason.trim();
    await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
  }
  const targetLabel = getTargetLabelForAudit("DISPATCH", item);
  const audit = buildAuditEntry({ actorSub, actorName, action, targetType: "DISPATCH", targetId: item.id, targetLabel, reason: reason ? String(reason).trim() : undefined, ts: nowIso });
  await writeAudit(ddb, tableName, audit);
  return { status: item.status };
}
