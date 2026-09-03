import { randomUUID } from "node:crypto";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { err } from "../lib/http.js";
import { maskName } from "../lib/format.js";

function needKey(needId) {
  return { PK: `NEED#${needId}`, SK: "META" };
}

export async function startGroup(ddb, tableName, { need, actorSub, actorName }) {
  const now = new Date().toISOString();
  const maskedBeneficiary = maskName(need.beneficiary?.name || "");
  const district = need.beneficiary?.district || need.district || "";
  const name = `Help group — ${maskedBeneficiary}, ${district}`;
  try {
    await ddb.send(new UpdateCommand({
      TableName: tableName,
      Key: { PK: need.PK, SK: need.SK },
      UpdateExpression: "SET #grp = :group, groupItems = :items, groupMembers = :members",
      ConditionExpression: "attribute_not_exists(#grp)",
      ExpressionAttributeNames: { "#grp": "group" },
      ExpressionAttributeValues: {
        ":group": { name, createdBy: actorSub, createdAt: now },
        ":items": {},
        ":members": { [actorSub]: { name: actorName, joinedAt: now } },
      },
    }));
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") throw err(409, "group_exists");
    throw e;
  }
  return { name, createdAt: now };
}

export async function addGroupItem(ddb, tableName, { needId, description, actorSub }) {
  const itemId = randomUUID();
  const now = new Date().toISOString();
  try {
    await ddb.send(new UpdateCommand({
      TableName: tableName,
      Key: needKey(needId),
      UpdateExpression: "SET groupItems.#id = :item",
      ConditionExpression: "attribute_exists(#grp)",
      ExpressionAttributeNames: { "#grp": "group", "#id": itemId },
      ExpressionAttributeValues: { ":item": { description, status: "open", addedBy: actorSub, createdAt: now } },
    }));
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") throw err(409, "no_group");
    throw e;
  }
  return { itemId, status: "open", createdAt: now };
}

export async function joinGroup(ddb, tableName, { needId, actorSub, actorName }) {
  const now = new Date().toISOString();
  try {
    await ddb.send(new UpdateCommand({
      TableName: tableName,
      Key: needKey(needId),
      UpdateExpression: "SET groupMembers.#sub = if_not_exists(groupMembers.#sub, :member)",
      ConditionExpression: "attribute_exists(#grp)",
      ExpressionAttributeNames: { "#grp": "group", "#sub": actorSub },
      ExpressionAttributeValues: { ":member": { name: actorName, joinedAt: now } },
    }));
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") throw err(400, "no_group");
    throw e;
  }
}

export async function claimGroupItem(ddb, tableName, { needId, itemId, actorSub, actorName }) {
  const now = new Date().toISOString();
  try {
    await ddb.send(new UpdateCommand({
      TableName: tableName,
      Key: needKey(needId),
      UpdateExpression:
        "SET groupItems.#id.claimedBy = :sub, groupItems.#id.claimedByName = :name, groupItems.#id.claimedAt = :now, " +
        "groupItems.#id.#st = :claimed, groupMembers.#sub = if_not_exists(groupMembers.#sub, :member)",
      ConditionExpression: "attribute_not_exists(groupItems.#id.claimedBy) OR groupItems.#id.claimedBy = :sub",
      ExpressionAttributeNames: { "#id": itemId, "#st": "status", "#sub": actorSub },
      ExpressionAttributeValues: {
        ":sub": actorSub, ":name": actorName, ":now": now, ":claimed": "claimed",
        ":member": { name: actorName, joinedAt: now },
      },
    }));
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") throw err(409, "already_claimed");
    throw e;
  }
  return { claimedBy: actorSub, claimedByName: actorName, claimedAt: now };
}

export async function releaseGroupItem(ddb, tableName, { needId, itemId, actorSub }) {
  try {
    await ddb.send(new UpdateCommand({
      TableName: tableName,
      Key: needKey(needId),
      UpdateExpression: "REMOVE groupItems.#id.claimedBy, groupItems.#id.claimedByName, groupItems.#id.claimedAt SET groupItems.#id.#st = :open",
      ConditionExpression: "groupItems.#id.claimedBy = :sub",
      ExpressionAttributeNames: { "#id": itemId, "#st": "status" },
      ExpressionAttributeValues: { ":sub": actorSub, ":open": "open" },
    }));
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") throw err(409, "not_claim_owner");
    throw e;
  }
}

export async function markGroupItemDone(ddb, tableName, { needId, itemId, actorSub }) {
  const now = new Date().toISOString();
  try {
    await ddb.send(new UpdateCommand({
      TableName: tableName,
      Key: needKey(needId),
      UpdateExpression: "SET groupItems.#id.#st = :done, groupItems.#id.doneAt = :now",
      ConditionExpression: "groupItems.#id.claimedBy = :sub AND groupItems.#id.#st = :claimed",
      ExpressionAttributeNames: { "#id": itemId, "#st": "status" },
      ExpressionAttributeValues: { ":sub": actorSub, ":claimed": "claimed", ":done": "done", ":now": now },
    }));
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") throw err(409, "not_claim_owner");
    throw e;
  }
  return { doneAt: now };
}
