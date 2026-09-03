import { PutCommand, DeleteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

export const MINE_TYPES = ["NEED", "OFFER", "MISSING", "GROUP"];

/** Private "this is mine" pointer. Only GET /me/dashboard reads it; nothing public does. */
export async function putPointer(ddb, tableName, { sub, type, id, createdAt }) {
  if (!MINE_TYPES.includes(type)) throw new Error(`bad pointer type ${type}`);
  await ddb.send(new PutCommand({
    TableName: tableName,
    Item: { PK: `USER#${sub}`, SK: `${type}#${id}`, type: "MINE", kind: type, id, sub, createdAt: createdAt || new Date().toISOString() },
  }));
}

export async function deletePointer(ddb, tableName, { sub, type, id }) {
  await ddb.send(new DeleteCommand({ TableName: tableName, Key: { PK: `USER#${sub}`, SK: `${type}#${id}` } }));
}

export async function listPointers(ddb, tableName, sub) {
  const res = await ddb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: { ":pk": `USER#${sub}` },
  }));
  return (res.Items || []).filter((it) => it.type === "MINE").sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}
