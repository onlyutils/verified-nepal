import { QueryCommand } from "@aws-sdk/lib-dynamodb";

export async function countGsi2(ddb, tableName, pk) {
  const res = await ddb.send(new QueryCommand({ TableName: tableName, IndexName: "GSI2", KeyConditionExpression: "gsi2pk = :pk", ExpressionAttributeValues: { ":pk": pk }, Select: "COUNT" }));
  if (typeof res.Count === "number") return res.Count;
  return (res.Items || []).length;
}

export async function getAdminStats(ddb, tableName) {
  const count = (pk) => countGsi2(ddb, tableName, pk);
  const needs = {
    pending: await count("NEED#pending"),
    published: await count("NEED#published"),
    matched: await count("NEED#matched"),
    fulfilled: await count("NEED#fulfilled"),
  };
  const offers = {
    pending: await count("OFFER#pending"),
    published: await count("OFFER#published"),
  };
  const projects = {
    pending: await count("PROJECT#pending"),
    published: await count("PROJECT#published"),
    "in-progress": await count("PROJECT#in-progress"),
    completed: await count("PROJECT#completed"),
  };
  const dispatches = {
    pending: await count("DISPATCH#pending"),
    published: await count("DISPATCH#published"),
  };
  const moderators = await count("USER#moderator");
  let oldest = null;
  for (const pk of ["NEED#pending", "OFFER#pending", "PROJECT#pending", "DISPATCH#pending"]) {
    const res = await ddb.send(new QueryCommand({ TableName: tableName, IndexName: "GSI2", KeyConditionExpression: "gsi2pk = :pk", ExpressionAttributeValues: { ":pk": pk }, ScanIndexForward: true, Limit: 1 }));
    const item = res.Items && res.Items[0];
    if (item && item.createdAt) {
      if (!oldest || item.createdAt < oldest) oldest = item.createdAt;
    }
  }
  let oldestPendingAgeHours = 0;
  if (oldest) {
    const diffMs = Date.now() - new Date(oldest).getTime();
    oldestPendingAgeHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (oldestPendingAgeHours < 0) oldestPendingAgeHours = 0;
  }
  return { needs, offers, projects, dispatches, oldestPendingAgeHours, moderators };
}
