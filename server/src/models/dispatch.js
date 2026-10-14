import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { buildAuditEntry, writeAudit, getTargetLabelForAudit } from "./audit.js";

export function dispatchKind(item) {
  return item?.kind === "news" ? "news" : "article";
}

export function localityGsiKey(district) {
  return `DISPATCH#LOC#${district}`;
}

/** Only published items with a locality enter the locality index. Expiry is descriptive. */
export function applyPublishKeys(item, nowIso) {
  item.status = "published";
  item.publishedAt = nowIso;
  item.gsi2pk = "DISPATCH#published";
  item.gsi2sk = nowIso;
  if (item.locality?.district) {
    item.gsi1pk = localityGsiKey(item.locality.district);
    item.gsi1sk = nowIso;
  } else {
    delete item.gsi1pk;
    delete item.gsi1sk;
  }
}

export async function queryLocalDispatches(ddb, tableName, { district, limit = 50 }) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "GSI1",
      KeyConditionExpression: "gsi1pk = :pk",
      ExpressionAttributeValues: { ":pk": localityGsiKey(district) },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return (res.Items || []).filter((it) => it.status === "published");
}

// ponytail: national items share the published partition; use a dedicated GSI key if their volume exceeds a page.
export async function queryNationalNews(ddb, tableName, { limit = 50 } = {}) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "GSI2",
      KeyConditionExpression: "gsi2pk = :pk",
      ExpressionAttributeValues: { ":pk": "DISPATCH#published" },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return (res.Items || []).filter(
    (it) => it.status === "published" && dispatchKind(it) === "news" && ["nepal", "national", "province"].includes(it.scope),
  );
}

// ponytail: kinds share the published partition; split GSI2 keys by kind if filtering becomes expensive.
export async function queryPublishedDispatchesPage(ddb, tableName, { tagRaw, kind = "article", cursorKey }) {
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
      if (dispatchKind(item) !== kind || (tagRaw && !item.tags?.includes(tagRaw))) continue;
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

export async function listPendingDispatches(ddb, tableName, { kind } = {}) {
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
    items.push(...(res.Items || []).filter((it) => !kind || dispatchKind(it) === kind));
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
