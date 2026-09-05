import { GetCommand, PutCommand, DeleteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

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
export async function listMissingByStatus(ddb, tableName, status) {
  const res = await ddb.send(new QueryCommand({
    TableName: tableName, IndexName: "GSI2", KeyConditionExpression: "gsi2pk = :pk",
    ExpressionAttributeValues: { ":pk": `MISSING#${status}` }, ScanIndexForward: false,
  }));
  return res.Items || [];
}
