import { GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

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
