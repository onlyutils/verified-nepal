import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

export function orgKey(id) {
  return `ORG#${id}`;
}

export async function createOrg(ddb, tableName, item) {
  await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
}

export async function getOrg(ddb, tableName, id) {
  const res = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: orgKey(id), SK: "META" } }));
  return res.Item || null;
}

export async function saveOrg(ddb, tableName, org) {
  await ddb.send(new PutCommand({ TableName: tableName, Item: org }));
}

export async function listOrgsByStatus(ddb, tableName, status) {
  const pk = `ORG#${status}`;
  const res = await ddb.send(new QueryCommand({
    TableName: tableName,
    IndexName: "GSI2",
    KeyConditionExpression: "gsi2pk = :pk",
    ExpressionAttributeValues: { ":pk": pk },
    ScanIndexForward: true,
  }));
  return res.Items || [];
}

export async function putMembership(ddb, tableName, { sub, orgId, role, orgName, email, name, createdAt }) {
  const now = createdAt || new Date().toISOString();
  const userItem = {
    PK: `USER#${sub}`,
    SK: `ORG#${orgId}`,
    type: "ORGMEMBER",
    sub,
    orgId,
    role,
    orgName,
    createdAt: now,
  };
  if (email) userItem.email = email;
  if (name) userItem.name = name;
  const orgItem = {
    PK: `ORG#${orgId}`,
    SK: `MEMBER#${sub}`,
    type: "ORGMEMBER",
    sub,
    orgId,
    role,
    orgName,
    createdAt: now,
  };
  if (email) orgItem.email = email;
  if (name) orgItem.name = name;
  await ddb.send(new PutCommand({ TableName: tableName, Item: userItem }));
  await ddb.send(new PutCommand({ TableName: tableName, Item: orgItem }));
}

export async function getMembership(ddb, tableName, sub, orgId) {
  const res = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `USER#${sub}`, SK: `ORG#${orgId}` } }));
  return res.Item || null;
}

export async function listUserMemberships(ddb, tableName, sub) {
  const res = await ddb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: { ":pk": `USER#${sub}` },
  }));
  const items = res.Items || [];
  return items.filter((it) => it.type === "ORGMEMBER" && String(it.SK || "").startsWith("ORG#"));
}

export async function listOrgMembers(ddb, tableName, orgId) {
  const res = await ddb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": `ORG#${orgId}`, ":prefix": "MEMBER#" },
  }));
  return res.Items || [];
}

export async function countOwnedOrgs(ddb, tableName, sub) {
  const memberships = await listUserMemberships(ddb, tableName, sub);
  return memberships.filter((m) => m.role === "owner").length;
}

export async function deleteMembership(ddb, tableName, sub, orgId) {
  await ddb.send(new DeleteCommand({ TableName: tableName, Key: { PK: `USER#${sub}`, SK: `ORG#${orgId}` } }));
  await ddb.send(new DeleteCommand({ TableName: tableName, Key: { PK: `ORG#${orgId}`, SK: `MEMBER#${sub}` } }));
}

export async function putInvite(ddb, tableName, { orgId, orgName, email, invitedBy, createdAt }) {
  const lower = String(email).toLowerCase();
  const invite = {
    PK: `EMAIL#${lower}`,
    SK: `ORGINVITE#${orgId}`,
    type: "ORGINVITE",
    orgId,
    orgName,
    role: "staff",
    email: lower,
    invitedBy,
    createdAt,
  };
  const pointer = {
    PK: `ORG#${orgId}`,
    SK: `INVITE#${lower}`,
    type: "ORGINVITE",
    orgId,
    orgName,
    role: "staff",
    email: lower,
    invitedBy,
    createdAt,
  };
  await ddb.send(new PutCommand({ TableName: tableName, Item: invite }));
  await ddb.send(new PutCommand({ TableName: tableName, Item: pointer }));
}

export async function getInviteForEmail(ddb, tableName, lowerEmail, orgId) {
  const lower = String(lowerEmail).toLowerCase();
  const res = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `EMAIL#${lower}`, SK: `ORGINVITE#${orgId}` } }));
  return res.Item || null;
}

export async function getInviteForOrg(ddb, tableName, orgId, lowerEmail) {
  const lower = String(lowerEmail).toLowerCase();
  const res = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `ORG#${orgId}`, SK: `INVITE#${lower}` } }));
  return res.Item || null;
}

export async function listInvitesForEmail(ddb, tableName, lowerEmail) {
  const lower = String(lowerEmail).toLowerCase();
  const res = await ddb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": `EMAIL#${lower}`, ":prefix": "ORGINVITE#" },
  }));
  return res.Items || [];
}

export async function listInvitesForOrg(ddb, tableName, orgId) {
  const res = await ddb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": `ORG#${orgId}`, ":prefix": "INVITE#" },
  }));
  return res.Items || [];
}

export async function deleteInvite(ddb, tableName, lowerEmail, orgId) {
  const lower = String(lowerEmail).toLowerCase();
  await ddb.send(new DeleteCommand({ TableName: tableName, Key: { PK: `EMAIL#${lower}`, SK: `ORGINVITE#${orgId}` } }));
  await ddb.send(new DeleteCommand({ TableName: tableName, Key: { PK: `ORG#${orgId}`, SK: `INVITE#${lower}` } }));
}
