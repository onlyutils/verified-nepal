import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { buildAuditEntry, writeAudit, getTargetLabelForAudit } from "./audit.js";

export function applyPublishKeys(item, nowIso) {
  item.status = "published";
  item.publishedAt = nowIso;
  item.gsi2pk = "DISPATCH#published";
  item.gsi2sk = nowIso;
  delete item.gsi1pk;
  delete item.gsi1sk;
}

export async function queryPublishedDispatchesPage(ddb, tableName, { tagRaw, cursorKey }) {
  const limit = 20;
  const collected = [];
  let ExclusiveStartKey = cursorKey;
  while (true) {
    const res = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "GSI2",
        KeyConditionExpression: "gsi2pk = :pk",
        ExpressionAttributeValues: { ":pk": "DISPATCH#published" },
        ScanIndexForward: false,
        Limit: limit,
        ...(ExclusiveStartKey ? { ExclusiveStartKey } : {}),
      }),
    );
    const items = res.Items || [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (tagRaw && !item.tags?.includes(tagRaw)) continue;
      collected.push(item);
      if (collected.length === limit) {
        // Resume at the last returned item, including all index keys, rather than skipping the rest of this DynamoDB page.
        const hasMore = i < items.length - 1 || Boolean(res.LastEvaluatedKey);
        const key = { PK: item.PK, SK: item.SK, gsi2pk: item.gsi2pk, gsi2sk: item.gsi2sk };
        return { sliced: collected, hasMore, lastEvaluatedKey: hasMore ? key : null };
      }
    }
    if (!res.LastEvaluatedKey) return { sliced: collected, hasMore: false, lastEvaluatedKey: null };
    ExclusiveStartKey = res.LastEvaluatedKey;
  }
}

export async function getDispatchById(ddb, tableName, id, { consistentRead = false } = {}) {
  return (
    await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: `DISPATCH#${id}`, SK: "META" },
        ...(consistentRead ? { ConsistentRead: true } : {}),
      }),
    )
  ).Item;
}

export async function listPendingDispatches(ddb, tableName) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "GSI2",
        KeyConditionExpression: "gsi2pk = :pk",
        ExpressionAttributeValues: { ":pk": "DISPATCH#pending" },
        ScanIndexForward: true,
        ...(ExclusiveStartKey ? { ExclusiveStartKey } : {}),
      }),
    );
    items.push(...(res.Items || []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  items.sort((a, b) => (a.submittedAt || a.createdAt || "").localeCompare(b.submittedAt || b.createdAt || ""));
  return items;
}

export async function moderateDispatch(ddb, tableName, { item, action, reason, actorSub, actorName }) {
  const nowIso = new Date().toISOString();
  if (action === "publish") {
    applyPublishKeys(item, nowIso);
    await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
  } else {
    item.status = "rejected";
    item.gsi2pk = "DISPATCH#rejected";
    item.gsi2sk = item.createdAt;
    if (reason && typeof reason === "string" && reason.trim()) item.rejectReason = reason.trim();
    else delete item.rejectReason;
    await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
  }
  const targetLabel = getTargetLabelForAudit("DISPATCH", item);
  const audit = buildAuditEntry({
    actorSub,
    actorName,
    action,
    targetType: "DISPATCH",
    targetId: item.id,
    targetLabel,
    reason: reason ? String(reason).trim() : undefined,
    ts: nowIso,
  });
  await writeAudit(ddb, tableName, audit);
  return { status: item.status };
}
