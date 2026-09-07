import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import { err } from "../lib/http.js";

export function assignmentKey(orgId) {
  return `ORG#${orgId}`;
}

export function assignmentSortKey(shiftDate, id) {
  return `ASSIGN#${shiftDate}#${id}`;
}

export function activitySortKey(at) {
  return `LOG#${at}#${randomUUID().replace(/-/g, "").slice(0, 6)}`;
}

export async function createAssignment(ddb, tableName, fields) {
  const id = fields.id || randomUUID();
  const createdAt = fields.createdAt || new Date().toISOString();
  const item = {
    PK: assignmentKey(fields.orgId),
    SK: assignmentSortKey(fields.shiftDate, id),
    type: "ASSIGNMENT",
    ...fields,
    id,
    status: fields.status || "assigned",
    statusAt: fields.statusAt || createdAt,
    createdAt,
  };
  await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
  return item;
}

export async function getAssignment(ddb, tableName, orgId, id) {
  const result = await ddb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": assignmentKey(orgId), ":prefix": "ASSIGN#" },
  }));
  return (result.Items || []).find((item) => item.id === id) || null;
}

export async function listAssignments(ddb, tableName, orgId, shiftDate) {
  const result = await ddb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": assignmentKey(orgId), ":prefix": `ASSIGN#${shiftDate}#` },
  }));
  return (result.Items || []).sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
}

export async function saveAssignment(ddb, tableName, assignment, expectedStatus) {
  const params = { TableName: tableName, Item: assignment };
  if (expectedStatus !== undefined) {
    params.ConditionExpression = "#status = :expectedStatus";
    params.ExpressionAttributeNames = { "#status": "status" };
    params.ExpressionAttributeValues = { ":expectedStatus": expectedStatus };
  }
  try {
    await ddb.send(new PutCommand(params));
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") throw err(409, "assignment_status_changed");
    throw error;
  }
  return assignment;
}

export async function createActivity(ddb, tableName, fields) {
  const item = {
    PK: assignmentKey(fields.orgId),
    SK: activitySortKey(fields.at),
    type: "ACTIVITY",
    ...fields,
  };
  await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
  return item;
}

export async function listActivities(ddb, tableName, orgId, date) {
  const result = await ddb.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": assignmentKey(orgId), ":prefix": `LOG#${date}` },
    ScanIndexForward: true,
  }));
  return (result.Items || [])
    .filter((item) => typeof item.at === "string" && item.at.startsWith(date))
    .sort((a, b) => (a.at || "").localeCompare(b.at || ""));
}
