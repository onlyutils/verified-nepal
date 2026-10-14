import { randomUUID } from "node:crypto";
import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { err } from "../lib/http.js";

const key = (id) => ({ PK: `AD#${id}`, SK: "META" });

function editableFields({ slot, target, image, href, label, startAt, endAt, note }) {
  return { slot, target, image, href, label, startAt, endAt, note };
}

export async function createAd(ddb, tableName, fields) {
  const id = randomUUID();
  const nowIso = new Date().toISOString();
  const item = {
    ...key(id),
    type: "AD",
    id,
    ...editableFields(fields),
    createdBy: fields.createdBy,
    createdAt: nowIso,
    updatedAt: nowIso,
    gsi2pk: `AD#${fields.slot}`,
    gsi2sk: fields.startAt,
  };
  await ddb.send(new PutCommand({ TableName: tableName, Item: item, ConditionExpression: "attribute_not_exists(PK)" }));
  return item;
}

export async function getAd(ddb, tableName, id) {
  const { Item } = await ddb.send(new GetCommand({ TableName: tableName, Key: key(id), ConsistentRead: true }));
  return Item;
}

export async function updateAd(ddb, tableName, id, fields) {
  const existing = await getAd(ddb, tableName, id);
  if (!existing) throw err(404, "not found");
  const item = {
    ...existing,
    ...editableFields(fields),
    updatedAt: new Date().toISOString(),
    gsi2pk: `AD#${fields.slot}`,
    gsi2sk: fields.startAt,
  };
  try {
    await ddb.send(new PutCommand({ TableName: tableName, Item: item, ConditionExpression: "attribute_exists(PK)" }));
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") throw err(404, "not found");
    throw e;
  }
  return item;
}

export async function deleteAd(ddb, tableName, id) {
  const existing = await getAd(ddb, tableName, id);
  if (!existing) throw err(404, "not found");
  try {
    await ddb.send(new DeleteCommand({ TableName: tableName, Key: key(id), ConditionExpression: "attribute_exists(PK)" }));
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") throw err(404, "not found");
    throw e;
  }
  return existing;
}

// ponytail: read all ads in a slot; add target-specific index partitions if the inventory grows large.
export async function listAds(ddb, tableName, { slot }) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new QueryCommand({
      TableName: tableName,
      IndexName: "GSI2",
      KeyConditionExpression: "gsi2pk = :pk",
      ExpressionAttributeValues: { ":pk": `AD#${slot}` },
      ScanIndexForward: false,
      ...(ExclusiveStartKey ? { ExclusiveStartKey } : {}),
    }));
    items.push(...(res.Items || []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

export function isActive(ad, nowIso) {
  const now = Date.parse(nowIso);
  return Date.parse(ad.startAt) <= now && now < Date.parse(ad.endAt);
}

export function pickAd(ads, { slot, district, municipalityId }, nowIso) {
  let best = null;
  let bestRank = 0;
  for (const ad of ads) {
    if (ad.slot !== slot || !isActive(ad, nowIso)) continue;
    let rank = 0;
    if (ad.target?.kind === "all") rank = 1;
    else if (ad.target?.kind === "district" && district && ad.target.value === district) rank = 2;
    else if (ad.target?.kind === "municipality" && municipalityId && String(ad.target.value) === String(municipalityId)) rank = 3;
    if (rank && (rank > bestRank || (rank === bestRank && Date.parse(ad.startAt) > Date.parse(best.startAt)))) {
      best = ad;
      bestRank = rank;
    }
  }
  return best;
}
