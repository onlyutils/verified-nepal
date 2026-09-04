import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

/** Pointer from an organization to a need it is handling: PK ORG#<orgId>, SK NEED#<needId>. */
export async function putOrgNeed(ddb, tableName, { orgId, needId, status, at }) {
  await ddb.send(new PutCommand({ TableName: tableName, Item: { PK: `ORG#${orgId}`, SK: `NEED#${needId}`, type: "ORGNEED", orgId, needId, status, updatedAt: at } }));
}

export async function deleteOrgNeed(ddb, tableName, { orgId, needId }) {
  await ddb.send(new DeleteCommand({ TableName: tableName, Key: { PK: `ORG#${orgId}`, SK: `NEED#${needId}` } }));
}

export async function listOrgNeeds(ddb, tableName, orgId) {
  const res = await ddb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": `ORG#${orgId}`, ":prefix": "NEED#" },
  }));
  return (res.Items || []).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}
