import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";

export function distributionKey(id) {
  return `DIST#${id}`;
}

export async function createDistribution(ddb, tableName, fields) {
  const id = fields.id || randomUUID();
  const createdAt = fields.createdAt || new Date().toISOString();
  const item = {
    PK: distributionKey(id),
    SK: "META",
    type: "DISTRIBUTION",
    ...fields,
    id,
    status: fields.status || "planned",
    createdAt,
    updatedAt: fields.updatedAt || createdAt,
    gsi1pk: `DIST#${fields.incidentId}#${fields.district}`,
    gsi1sk: `${fields.plannedDate}#${createdAt}`,
    gsi2pk: `DIST#${fields.status || "planned"}`,
    gsi2sk: createdAt,
  };
  await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
  return item;
}

export async function getDistribution(ddb, tableName, id) {
  const result = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: distributionKey(id), SK: "META" } }));
  return result.Item || null;
}

export async function listDistributionsByStatus(ddb, tableName, status) {
  const result = await ddb.send(new QueryCommand({
    TableName: tableName,
    IndexName: "GSI2",
    KeyConditionExpression: "gsi2pk = :pk",
    ExpressionAttributeValues: { ":pk": `DIST#${status}` },
    ScanIndexForward: false,
  }));
  return result.Items || [];
}

export async function listDistributions(ddb, tableName, { status, orgId, incidentId, district, plannedDate } = {}) {
  const statuses = status ? [status] : ["planned", "acknowledged", "completed", "cancelled"];
  const items = [];
  for (const currentStatus of statuses) items.push(...await listDistributionsByStatus(ddb, tableName, currentStatus));
  const seen = new Set();
  return items
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return (!orgId || item.orgId === orgId)
        && (!incidentId || item.incidentId === incidentId)
        && (!district || item.district === district)
        && (!plannedDate || item.plannedDate === plannedDate);
    })
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export async function listDistributionsForIncident(ddb, tableName, { incidentId, district }) {
  if (!district) return listDistributions(ddb, tableName, { incidentId });
  const result = await ddb.send(new QueryCommand({
    TableName: tableName,
    IndexName: "GSI1",
    KeyConditionExpression: "gsi1pk = :pk",
    ExpressionAttributeValues: { ":pk": `DIST#${incidentId}#${district}` },
    ScanIndexForward: false,
  }));
  return (result.Items || []).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export async function saveDistribution(ddb, tableName, distribution, expectedStatuses = []) {
  const params = { TableName: tableName, Item: distribution };
  if (expectedStatuses.length) {
    params.ConditionExpression = expectedStatuses.map((_, index) => `#status = :expected${index}`).join(" OR ");
    params.ExpressionAttributeNames = { "#status": "status" };
    params.ExpressionAttributeValues = Object.fromEntries(expectedStatuses.map((status, index) => [`:expected${index}`, status]));
  }
  try {
    await ddb.send(new PutCommand(params));
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      const conflict = new Error("distribution_status_changed");
      conflict.status = 409;
      throw conflict;
    }
    throw error;
  }
  return distribution;
}
