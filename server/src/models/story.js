import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { listPointers, putPointer, deletePointer } from "./mine.js";
import { listUserMemberships } from "./org.js";
import { listOrgCenterPointers } from "./center.js";
import { listAllEntries } from "./goods.js";
import { listOrgNeeds } from "./orgNeed.js";

export const STORY_ROLES = ["needy", "helper", "org"];

/**
 * Who this person may tell a story as: "needy" (a request of theirs was fulfilled),
 * "helper" (an offer was matched or they finished a group item), "org" (a member of an
 * organization whose center has recorded a distribution). null = nothing to tell yet.
 * ponytail: one read per pointer/center; people own tens of items, not thousands.
 */
export async function storyRole(ddb, tableName, sub) {
  let helper = false;
  for (const p of await listPointers(ddb, tableName, sub)) {
    if (!["NEED", "OFFER", "GROUP"].includes(p.kind)) continue;
    const pk = p.kind === "GROUP" ? `NEED#${p.id}` : `${p.kind}#${p.id}`;
    const item = (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: pk, SK: "META" } }))).Item;
    if (!item) continue;
    if (p.kind === "NEED" && item.status === "fulfilled") return "needy";
    if (p.kind === "OFFER" && ["matched", "fulfilled"].includes(item.status)) helper = true;
    if (p.kind === "GROUP" && Object.values(item.groupItems || {}).some((it) => it.claimedBy === sub && it.status === "done")) helper = true;
  }
  if (helper) return "helper";
  for (const m of await listUserMemberships(ddb, tableName, sub)) {
    if ((await listOrgNeeds(ddb, tableName, m.orgId)).some((n) => n.status === "fulfilled")) return "org";
    for (const c of await listOrgCenterPointers(ddb, tableName, m.orgId)) {
      const centerId = c.centerId || String(c.SK).replace(/^CENTER#/, "");
      if ((await listAllEntries(ddb, tableName, centerId)).some((e) => e.entryType === "distribution")) return "org";
    }
  }
  return null;
}

export async function createStory(ddb, tableName, item) {
  await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
  await putPointer(ddb, tableName, { sub: item.authorSub, type: "STORY", id: item.id, createdAt: item.createdAt });
}

export async function getStory(ddb, tableName, id) {
  return (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `STORY#${id}`, SK: "META" } }))).Item;
}

export async function deleteStory(ddb, tableName, story) {
  await ddb.send(new DeleteCommand({ TableName: tableName, Key: { PK: story.PK, SK: story.SK } }));
  await deletePointer(ddb, tableName, { sub: story.authorSub, type: "STORY", id: story.id });
}

/** Newest first for the public strip, oldest first for the moderation queue. */
export async function listStoriesByStatus(ddb, tableName, status, { newestFirst, limit, cursorKey } = {}) {
  const res = await ddb.send(new QueryCommand({
    TableName: tableName, IndexName: "GSI2", KeyConditionExpression: "gsi2pk = :pk",
    ExpressionAttributeValues: { ":pk": `STORY#${status}` }, ScanIndexForward: !newestFirst,
    ...(limit ? { Limit: limit } : {}), ...(cursorKey ? { ExclusiveStartKey: cursorKey } : {}),
  }));
  return { items: res.Items || [], lastEvaluatedKey: res.LastEvaluatedKey || null };
}

export async function moderateStory(ddb, tableName, story, { action, reason }) {
  const now = new Date().toISOString();
  story.status = action === "publish" ? "published" : "rejected";
  story.gsi2pk = `STORY#${story.status}`;
  story.gsi2sk = action === "publish" ? now : story.createdAt;
  if (action === "publish") { story.publishedAt = now; delete story.rejectReason; }
  else if (reason) story.rejectReason = reason;
  await ddb.send(new PutCommand({ TableName: tableName, Item: story }));
}
