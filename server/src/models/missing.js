import { GetCommand, PutCommand, DeleteCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

export async function getMissingById(ddb, tableName, id) {
  return (await ddb.send(new GetCommand({
    TableName: tableName,
    Key: { PK: `MISSING#${id}`, SK: "META" },
  }))).Item;
}

export async function putMissing(ddb, tableName, item) {
  await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
}

export async function deleteMissing(ddb, tableName, id) {
  await ddb.send(new DeleteCommand({
    TableName: tableName,
    Key: { PK: `MISSING#${id}`, SK: "META" },
  }));
}

/** Newest first. ponytail: no pagination; add a cursor when one status passes ~1 MB of items. */
export async function listMissingByModerationStatus(ddb, tableName, status) {
  const res = await ddb.send(new QueryCommand({
    TableName: tableName, IndexName: "GSI2", KeyConditionExpression: "gsi2pk = :pk",
    ExpressionAttributeValues: { ":pk": `MISSING#${status}` }, ScanIndexForward: false,
  }));
  return res.Items || [];
}

export function isPublishedMissing(item) {
  return item?.publicationStatus === undefined || item.publicationStatus === "published";
}

export async function listPublishedMissing(ddb, tableName) {
  const [published, legacy] = await Promise.all([
    listMissingByModerationStatus(ddb, tableName, "published"),
    listLegacyMissing(ddb, tableName),
  ]);
  const seen = new Set(published.map((item) => `${item.PK}|${item.SK}`));
  return [...published, ...legacy.filter((item) => !seen.has(`${item.PK}|${item.SK}`))]
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

async function listLegacyMissing(ddb, tableName) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: "#type = :type AND attribute_not_exists(publicationStatus)",
      ExpressionAttributeNames: { "#type": "type" },
      ExpressionAttributeValues: { ":type": "MISSING" },
      ...(ExclusiveStartKey ? { ExclusiveStartKey } : {}),
    }));
    items.push(...(res.Items || []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items.filter((item) => item.type === "MISSING" && item.publicationStatus === undefined);
}

export async function listMissingTips(ddb, tableName, id) {
  const res = await ddb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": `MISSING#${id}`, ":prefix": "TIP#" },
    ScanIndexForward: false,
  }));
  return res.Items || [];
}
