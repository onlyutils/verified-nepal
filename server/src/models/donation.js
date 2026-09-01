import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

export async function putDonation(ddb, tableName, item) {
  await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
}

export async function putCenterDonationPointer(ddb, tableName, item) {
  await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
}

export async function getDonation(ddb, tableName, ref) {
  const res = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `DONATION#${ref}`, SK: "META" } }));
  return res.Item || null;
}

export async function getCenterDonationPointer(ddb, tableName, centerId, declaredAt, ref) {
  const sk = `DONATION#${declaredAt}#${ref}`;
  const res = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `CENTER#${centerId}`, SK: sk } }));
  return res.Item || null;
}

export async function listCenterDonationsRaw(ddb, tableName, centerId) {
  const res = await ddb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": `CENTER#${centerId}`, ":prefix": "DONATION#" },
  }));
  return res.Items || [];
}

export async function deleteDonationPointer(ddb, tableName, centerId, declaredAt, ref) {
  const sk = `DONATION#${declaredAt}#${ref}`;
  await ddb.send(new DeleteCommand({ TableName: tableName, Key: { PK: `CENTER#${centerId}`, SK: sk } }));
}

export async function updateDonation(ddb, tableName, donation, centerDonation) {
  await ddb.send(new PutCommand({ TableName: tableName, Item: donation }));
  if (centerDonation) {
    await ddb.send(new PutCommand({ TableName: tableName, Item: centerDonation }));
  }
}
