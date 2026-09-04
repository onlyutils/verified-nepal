import { randomUUID } from "node:crypto";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { err } from "../lib/http.js";

function slugify(value) {
  const base = String(value).normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return base || "incident";
}

function withSuffix(base) {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 8);
  return `${base.slice(0, 51)}-${suffix}`;
}

export async function createIncident(ddb, tableName, fields) {
  const base = slugify(fields.name);
  let id = base.length >= 3 ? base : withSuffix(base);
  for (let tries = 0; tries < 5; tries++) {
    const existing = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `INCIDENT#${id}`, SK: "META" } }));
    if (!existing.Item) break;
    id = withSuffix(base);
    if (tries === 4) throw err(500, "Failed to generate incident id");
  }
  const createdAt = new Date().toISOString();
  const item = {
    PK: `INCIDENT#${id}`,
    SK: "META",
    type: "INCIDENT",
    id,
    ...fields,
    createdAt,
    gsi1pk: `INCIDENT#${fields.status}`,
    gsi1sk: createdAt,
  };
  await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
  return { id, item };
}

export async function getIncidentById(ddb, tableName, id) {
  return (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `INCIDENT#${id}`, SK: "META" } }))).Item || null;
}

export async function saveIncident(ddb, tableName, incident) {
  await ddb.send(new PutCommand({ TableName: tableName, Item: incident }));
}

export async function listIncidentsByStatus(ddb, tableName, statuses) {
  const items = [];
  for (const status of statuses) {
    const res = await ddb.send(new QueryCommand({
      TableName: tableName,
      IndexName: "GSI1",
      KeyConditionExpression: "gsi1pk = :pk",
      ExpressionAttributeValues: { ":pk": `INCIDENT#${status}` },
      ScanIndexForward: false,
    }));
    if (res.Items) items.push(...res.Items);
  }
  items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return items;
}
