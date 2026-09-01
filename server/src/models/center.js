import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

export function centerKey(id) {
  return `CENTER#${id}`;
}

export async function createCenter(ddb, tableName, item) {
  await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
  const pointer = {
    PK: `ORG#${item.orgId}`,
    SK: `CENTER#${item.id}`,
    type: "ORGCENTER",
    centerId: item.id,
    orgId: item.orgId,
    name: item.name,
    district: item.district,
    status: item.status,
    createdAt: item.createdAt,
  };
  await ddb.send(new PutCommand({ TableName: tableName, Item: pointer }));
}

export async function getCenter(ddb, tableName, id) {
  const res = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: centerKey(id), SK: "META" } }));
  return res.Item || null;
}

export async function saveCenter(ddb, tableName, center) {
  await ddb.send(new PutCommand({ TableName: tableName, Item: center }));
  const pointer = {
    PK: `ORG#${center.orgId}`,
    SK: `CENTER#${center.id}`,
    type: "ORGCENTER",
    centerId: center.id,
    orgId: center.orgId,
    name: center.name,
    district: center.district,
    status: center.status,
    createdAt: center.createdAt,
  };
  await ddb.send(new PutCommand({ TableName: tableName, Item: pointer }));
}

export async function listOrgCenterPointers(ddb, tableName, orgId) {
  const res = await ddb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": `ORG#${orgId}`, ":prefix": "CENTER#" },
  }));
  return res.Items || [];
}

export async function listCentersByDistrict(ddb, tableName, district, cursorKey) {
  const res = await ddb.send(new QueryCommand({
    TableName: tableName,
    IndexName: "GSI1",
    KeyConditionExpression: "gsi1pk = :pk",
    ExpressionAttributeValues: { ":pk": `CENTER#${district}` },
    ScanIndexForward: false,
    Limit: 20,
    ...(cursorKey ? { ExclusiveStartKey: cursorKey } : {}),
  }));
  return res;
}

export async function listPublicCenters(ddb, tableName, cursorKey) {
  const res = await ddb.send(new QueryCommand({
    TableName: tableName,
    IndexName: "GSI2",
    KeyConditionExpression: "gsi2pk = :pk",
    ExpressionAttributeValues: { ":pk": "CENTER#public" },
    ScanIndexForward: false,
    Limit: 20,
    ...(cursorKey ? { ExclusiveStartKey: cursorKey } : {}),
  }));
  return res;
}

export function centerVisibility(orgStatus, centerStatus) {
  const orgOk = orgStatus === "pending" || orgStatus === "verified";
  const centerOk = centerStatus === "open" || centerStatus === "paused";
  return orgOk && centerOk ? "public" : "hidden";
}

export async function listFlaggedCenterPointers(ddb, tableName) {
  const res = await ddb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": "FLAGGED", ":prefix": "CENTER#" },
  }));
  return res.Items || [];
}

export async function listCenterFlags(ddb, tableName, centerId) {
  const res = await ddb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": `CENTER#${centerId}`, ":prefix": "FLAG#" },
  }));
  const items = res.Items || [];
  return items.map((f) => ({ reason: f.reason, details: f.details, createdAt: f.createdAt })).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function refreshCentersForOrg(ddb, tableName, org) {
  const pointers = await listOrgCenterPointers(ddb, tableName, org.id);
  for (const p of pointers) {
    const center = await getCenter(ddb, tableName, p.centerId);
    if (!center) continue;
    center.orgStatus = org.status;
    center.orgTier = org.tier || undefined;
    center.orgName = org.name;
    center.visibility = centerVisibility(org.status, center.status);
    center.gsi2pk = `CENTER#${center.visibility}`;
    if (!center.orgTier) delete center.orgTier;
    await saveCenter(ddb, tableName, center);
  }
}
