import { PutCommand, DeleteCommand, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

export const MINE_TYPES = ["NEED", "OFFER", "MISSING", "GROUP", "DONATION", "ARTICLE", "STORY", "INCIDENT", "PROJECT"];

/** Private "this is mine" pointer. Only GET /me/dashboard reads it; nothing public does. */
export async function putPointer(ddb, tableName, { sub, type, id, createdAt }) {
  if (!MINE_TYPES.includes(type)) throw new Error(`bad pointer type ${type}`);
  await ddb.send(new PutCommand({
    TableName: tableName,
    Item: { PK: `USER#${sub}`, SK: `${type}#${id}`, type: "MINE", kind: type, id, sub, createdAt: createdAt || new Date().toISOString() },
  }));
}

/** Did `sub` create this item? Used only to block a moderator from moderating their own submission. */
export async function hasPointer(ddb, tableName, { sub, type, id }) {
  const res = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `USER#${sub}`, SK: `${type}#${id}` } }));
  return !!res.Item;
}

export async function deletePointer(ddb, tableName, { sub, type, id }) {
  await ddb.send(new DeleteCommand({ TableName: tableName, Key: { PK: `USER#${sub}`, SK: `${type}#${id}` } }));
}

export async function putHandlingPointer(ddb, tableName, { sub, needId, createdAt }) {
  await ddb.send(new PutCommand({
    TableName: tableName,
    Item: { PK: `USER#${sub}`, SK: `HANDLING#${needId}`, type: "HANDLING", kind: "NEED", id: needId, sub, createdAt: createdAt || new Date().toISOString() },
  }));
}

export async function deleteHandlingPointer(ddb, tableName, { sub, needId }) {
  await ddb.send(new DeleteCommand({ TableName: tableName, Key: { PK: `USER#${sub}`, SK: `HANDLING#${needId}` } }));
}

export async function listPointers(ddb, tableName, sub) {
  const res = await ddb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: { ":pk": `USER#${sub}` },
  }));
  return (res.Items || []).filter((it) => it.type === "MINE").sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}
