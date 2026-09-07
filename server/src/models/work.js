import { QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

export function workKey(action) {
  return String(action).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export async function tallyWork(ddb, tableName, sub, action, ts) {
  if (!sub) return;
  const month = ts.slice(0, 7);
  await ddb.send(new UpdateCommand({
    TableName: tableName,
    Key: { PK: `USER#${sub}`, SK: `WORK#${month}` },
    UpdateExpression: "ADD #c :one, #total :one SET #type = :type, #sub = :sub, #month = :month, #updatedAt = :ts",
    ExpressionAttributeNames: { "#c": `c_${workKey(action)}`, "#total": "total", "#type": "type", "#sub": "sub", "#month": "month", "#updatedAt": "updatedAt" },
    ExpressionAttributeValues: { ":one": 1, ":type": "WORK", ":sub": sub, ":month": month, ":ts": ts },
  }));
}

export async function getWork(ddb, tableName, sub) {
  const result = await ddb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": `USER#${sub}`, ":prefix": "WORK#" },
    ScanIndexForward: false,
  }));
  const months = (result.Items || []).map((item) => {
    const counts = {};
    for (const [key, value] of Object.entries(item)) {
      if (key.startsWith("c_")) counts[key.slice(2)] = value;
    }
    return { month: item.month, counts, total: item.total || 0 };
  });
  const lifetime = { counts: {}, total: 0 };
  for (const month of months) {
    lifetime.total += month.total;
    for (const [key, value] of Object.entries(month.counts)) lifetime.counts[key] = (lifetime.counts[key] || 0) + value;
  }
  return { months, lifetime };
}
