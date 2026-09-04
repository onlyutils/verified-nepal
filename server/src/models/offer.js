import { randomUUID } from "node:crypto";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ttlSeconds, toExpiresAt, maskName } from "../lib/format.js";
import { PUBLIC_OFFER_STATUSES } from "../constants.js";

export async function createOffer(ddb, tableName, { helperSub, helperName, org, categories, districts, description, phone, email, incidentId }) {
  const helperLabel = maskName(helperName);
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const ttl = ttlSeconds(30);
  const expiresAt = toExpiresAt(ttl);
  const status = "pending";
  const item = {
    PK: `OFFER#${id}`,
    SK: "META",
    type: "OFFER",
    id,
    incidentId,
    helperSub,
    helperLabel,
    org,
    categories,
    districts,
    description,
    phone,
    email,
    status,
    createdAt,
    ttl,
    expiresAt,
    gsi1pk: `OFFER#${incidentId}#${districts[0]}#${status}`,
    gsi1sk: createdAt,
    gsi2pk: `OFFER#${status}`,
    gsi2sk: createdAt,
  };
  if (!org) delete item.org;
  if (!item.email) delete item.email;
  await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
  return { id };
}

export async function listPublicOffers(ddb, tableName, { incidentId, district, category }) {
  let items = [];
  if (district) {
    for (const status of PUBLIC_OFFER_STATUSES) {
      const pk = `OFFER#${incidentId}#${district}#${status}`;
      const res = await ddb.send(new QueryCommand({
        TableName: tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "gsi1pk = :pk",
        ExpressionAttributeValues: { ":pk": pk },
        ScanIndexForward: false,
      }));
      if (res.Items) items.push(...res.Items.filter((item) => item.incidentId === incidentId));
    }
    items = items.filter((it) => Array.isArray(it.districts) && it.districts.includes(district));
  } else {
    for (const status of PUBLIC_OFFER_STATUSES) {
      const pk = `OFFER#${status}`;
      const res = await ddb.send(new QueryCommand({
        TableName: tableName,
        IndexName: "GSI2",
        KeyConditionExpression: "gsi2pk = :pk",
        ExpressionAttributeValues: { ":pk": pk },
        ScanIndexForward: false,
      }));
      if (res.Items) items.push(...res.Items);
    }
  }
  if (category) items = items.filter((it) => Array.isArray(it.categories) && it.categories.includes(category));
  items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return items;
}
