import { QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const REACH_STATS_PK = "REACH#STATS";
const REACH_PATH_PAGES = new Set(["dropCenterDetail", "floodImpact", "dispatchDetail", "projectDetail", "posterView"]);
const ONE = 1;

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function dateDaysAgo(days) {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(today - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function addCounter(ddb, tableName, key, newSession = false) {
  const names = { "#views": "views" };
  let updateExpression = "ADD #views :one";
  if (newSession) {
    names["#sessions"] = "sessions";
    updateExpression += ", #sessions :one";
  }
  await ddb.send(new UpdateCommand({
    TableName: tableName,
    Key: key,
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: { ":one": ONE },
    ReturnValues: "ALL_NEW",
  }));
}

export async function recordPageView(ddb, tableName, { page, path, lang, ref, newSession }) {
  const date = todayUtc();
  const writes = [
    addCounter(ddb, tableName, { PK: REACH_STATS_PK, SK: "TOTAL" }, newSession),
    addCounter(ddb, tableName, { PK: REACH_STATS_PK, SK: `DAY#${date}` }, newSession),
    addCounter(ddb, tableName, { PK: REACH_STATS_PK, SK: `DAY#${date}#PAGE#${page}` }),
    addCounter(ddb, tableName, { PK: REACH_STATS_PK, SK: `PAGE#${page}` }),
    addCounter(ddb, tableName, { PK: REACH_STATS_PK, SK: `LANG#${lang}` }),
  ];
  if (REACH_PATH_PAGES.has(page)) {
    writes.push(addCounter(ddb, tableName, { PK: REACH_STATS_PK, SK: `PATH#${page}#${path}` }));
  }
  if (ref) writes.push(addCounter(ddb, tableName, { PK: REACH_STATS_PK, SK: `REF#${ref}` }));
  await Promise.all(writes);
}

async function queryReachPartition(ddb, tableName) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": REACH_STATS_PK },
      ...(ExclusiveStartKey ? { ExclusiveStartKey } : {}),
    }));
    if (res.Items) items.push(...res.Items);
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

export async function getReachAdminStats(ddb, tableName) {
  // ponytail: Whole-partition reads are acceptable while this partition grows ~40 DAY rows/day; upgrade to a BETWEEN range query on DAY# when it becomes too large.
  const items = await queryReachPartition(ddb, tableName);
  const bySk = new Map(items.map((item) => [item.SK, item]));
  const total = bySk.get("TOTAL") || {};
  const days = Array.from({ length: 30 }, (_, index) => {
    const date = dateDaysAgo(29 - index);
    const item = bySk.get(`DAY#${date}`) || {};
    return { date, views: item.views || 0, sessions: item.sessions || 0, pages: {} };
  });
  const daysByDate = new Map(days.map((day) => [day.date, day]));
  const last30ByPage = new Map();

  for (const item of items) {
    if (typeof item.SK !== "string") continue;
    const match = item.SK.match(/^DAY#(\d{4}-\d{2}-\d{2})#PAGE#(.+)$/);
    if (!match) continue;
    const day = daysByDate.get(match[1]);
    if (!day) continue;
    const page = match[2];
    const views = item.views || 0;
    day.pages[page] = views;
    last30ByPage.set(page, (last30ByPage.get(page) || 0) + views);
  }

  const pageViews = new Map();
  for (const item of items) {
    if (typeof item.SK !== "string" || !item.SK.startsWith("PAGE#")) continue;
    const page = item.SK.slice("PAGE#".length);
    if (page) pageViews.set(page, item.views || 0);
  }
  for (const page of last30ByPage.keys()) if (!pageViews.has(page)) pageViews.set(page, 0);
  const pages = Array.from(pageViews, ([page, views]) => ({ page, views, last30: last30ByPage.get(page) || 0 }))
    .sort((a, b) => b.last30 - a.last30 || b.views - a.views || a.page.localeCompare(b.page));

  const paths = items
    .filter((item) => typeof item.SK === "string" && item.SK.startsWith("PATH#"))
    .map((item) => {
      const separator = item.SK.indexOf("#", "PATH#".length);
      return {
        page: separator === -1 ? item.SK.slice("PATH#".length) : item.SK.slice("PATH#".length, separator),
        path: separator === -1 ? "" : item.SK.slice(separator + 1),
        views: item.views || 0,
      };
    })
    .sort((a, b) => b.views - a.views || a.page.localeCompare(b.page) || a.path.localeCompare(b.path))
    .slice(0, 100);

  const referrers = items
    .filter((item) => typeof item.SK === "string" && item.SK.startsWith("REF#"))
    .map((item) => ({ host: item.SK.slice("REF#".length), views: item.views || 0 }))
    .sort((a, b) => b.views - a.views || a.host.localeCompare(b.host))
    .slice(0, 20);

  const today = days[days.length - 1];
  const last30 = days.reduce(
    (result, day) => ({ views: result.views + day.views, sessions: result.sessions + day.sessions }),
    { views: 0, sessions: 0 },
  );

  return {
    totals: { views: total.views || 0, sessions: total.sessions || 0 },
    today: { views: today.views, sessions: today.sessions },
    last30,
    days,
    pages,
    paths,
    referrers,
    languages: {
      en: bySk.get("LANG#en")?.views || 0,
      ne: bySk.get("LANG#ne")?.views || 0,
    },
  };
}
