import { QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { CLIMATE_DOWNLOAD_KINDS, CLIMATE_MESSAGE_IDS } from "../constants.js";

const CLIMATE_MESSAGE_PK = "CLIMATE#MSG";
const CLIMATE_STATS_PK = "CLIMATE#STATS";
const ONE = 1;

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

async function addCounter(ddb, tableName, key, attribute) {
  const result = await ddb.send(new UpdateCommand({
    TableName: tableName,
    Key: key,
    UpdateExpression: "ADD #attribute :one",
    ExpressionAttributeNames: { "#attribute": attribute },
    ExpressionAttributeValues: { ":one": ONE },
    ReturnValues: "ALL_NEW",
  }));
  return result.Attributes?.[attribute] ?? ONE;
}

async function addMessageCounter(ddb, tableName, { iso3, messageId }) {
  const result = await ddb.send(new UpdateCommand({
    TableName: tableName,
    Key: { PK: CLIMATE_MESSAGE_PK, SK: `${iso3}#${messageId}` },
    UpdateExpression: "ADD #count :one SET #iso3 = :iso3, #messageId = :messageId, #updatedAt = :updatedAt",
    ExpressionAttributeNames: {
      "#count": "count",
      "#iso3": "iso3",
      "#messageId": "messageId",
      "#updatedAt": "updatedAt",
    },
    ExpressionAttributeValues: {
      ":one": ONE,
      ":iso3": iso3,
      ":messageId": messageId,
      ":updatedAt": new Date().toISOString(),
    },
    ReturnValues: "ALL_NEW",
  }));
  return result.Attributes?.count ?? ONE;
}

export async function recordMessage(ddb, tableName, { iso3, messageId }) {
  const date = todayUtc();
  const count = await addMessageCounter(ddb, tableName, { iso3, messageId });
  await addCounter(ddb, tableName, { PK: CLIMATE_STATS_PK, SK: "TOTAL" }, "messages");
  await addCounter(ddb, tableName, { PK: CLIMATE_STATS_PK, SK: `DAY#${date}` }, "messages");
  await addCounter(ddb, tableName, { PK: CLIMATE_STATS_PK, SK: `COUNTRY#${iso3}` }, "messages");
  return count;
}

export async function recordDownload(ddb, tableName, kind) {
  const date = todayUtc();
  await addCounter(ddb, tableName, { PK: CLIMATE_STATS_PK, SK: `DL#${kind}` }, "count");
  await addCounter(ddb, tableName, { PK: CLIMATE_STATS_PK, SK: "TOTAL" }, "downloads");
  await addCounter(ddb, tableName, { PK: CLIMATE_STATS_PK, SK: `DAY#${date}` }, "downloads");
}

async function queryClimatePartition(ddb, tableName, prefix) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: prefix ? "PK = :pk AND begins_with(SK, :prefix)" : "PK = :pk",
      ExpressionAttributeValues: prefix
        ? { ":pk": CLIMATE_MESSAGE_PK, ":prefix": prefix }
        : { ":pk": CLIMATE_MESSAGE_PK },
      ...(ExclusiveStartKey ? { ExclusiveStartKey } : {}),
    }));
    if (res.Items) items.push(...res.Items);
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

export async function listMessageCounts(ddb, tableName, country) {
  const items = await queryClimatePartition(ddb, tableName, country ? `${country}#` : "");
  return items
    .map((item) => ({ iso3: item.iso3, messageId: item.messageId, count: item.count || 0 }))
    .filter((item) => item.iso3 && item.messageId);
}

function dateDaysAgo(days) {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(today - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function getClimateAdminStats(ddb, tableName) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": CLIMATE_STATS_PK },
      ...(ExclusiveStartKey ? { ExclusiveStartKey } : {}),
    }));
    if (res.Items) items.push(...res.Items);
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  const bySk = new Map(items.map((item) => [item.SK, item]));
  const total = bySk.get("TOTAL") || {};
  const days = Array.from({ length: 30 }, (_, index) => {
    const date = dateDaysAgo(29 - index);
    const item = bySk.get(`DAY#${date}`) || {};
    return { date, messages: item.messages || 0, downloads: item.downloads || 0 };
  });

  const downloadsByKind = CLIMATE_DOWNLOAD_KINDS.map((kind) => ({
    kind,
    count: bySk.get(`DL#${kind}`)?.count || 0,
  }));

  const topCountries = items
    .filter((item) => typeof item.SK === "string" && item.SK.startsWith("COUNTRY#"))
    .map((item) => ({ iso3: item.SK.slice("COUNTRY#".length), messages: item.messages || 0 }))
    .sort((a, b) => b.messages - a.messages || a.iso3.localeCompare(b.iso3))
    .slice(0, 20);

  const counts = new Map();
  const messageItems = await queryClimatePartition(ddb, tableName, "");
  for (const item of messageItems) counts.set(item.messageId, item.count || 0);
  const topMessages = CLIMATE_MESSAGE_IDS
    .map((messageId, index) => ({ messageId, count: counts.get(messageId) || 0, index }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map(({ messageId, count }) => ({ messageId, count }));

  return {
    totals: { messages: total.messages || 0, downloads: total.downloads || 0 },
    days,
    downloadsByKind,
    topCountries,
    topMessages,
  };
}
