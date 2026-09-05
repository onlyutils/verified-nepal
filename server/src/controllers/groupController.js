import { json, err, parseBody } from "../lib/http.js";
import { validateString } from "../lib/validate.js";
import { maskName } from "../lib/format.js";
import { getNeedById } from "../models/need.js";
import { putPointer } from "../models/mine.js";
import {
  startGroup, addGroupItem, joinGroup, claimGroupItem, releaseGroupItem, markGroupItemDone,
} from "../models/group.js";

async function loadNeedWithGroup(ddb, tableName, needId) {
  const need = await getNeedById(ddb, tableName, needId);
  if (!need) throw err(404, "not found");
  return need;
}

export async function handlePostGroup(event, opts, needId) {
  const { auth } = opts;
  const { ddb, tableName } = auth;
  const need = await loadNeedWithGroup(ddb, tableName, needId);
  if (need.status !== "published") throw err(400, "need must be published to form a group");
  if (need.group) throw err(409, "group_exists");
  const actorName = maskName(auth.user?.name || auth.payload.name || "");
  const result = await startGroup(ddb, tableName, { need, actorSub: auth.payload.sub, actorName });
  await putPointer(ddb, tableName, { sub: auth.payload.sub, type: "GROUP", id: needId });
  return json(201, result);
}

export async function handlePostGroupJoin(event, opts, needId) {
  const { auth } = opts;
  const { ddb, tableName } = auth;
  const need = await loadNeedWithGroup(ddb, tableName, needId);
  if (!need.group) throw err(400, "no_group");
  const actorName = maskName(auth.user?.name || auth.payload.name || "");
  await joinGroup(ddb, tableName, { needId, actorSub: auth.payload.sub, actorName });
  await putPointer(ddb, tableName, { sub: auth.payload.sub, type: "GROUP", id: needId });
  return json(200, { ok: true });
}

export async function handlePostGroupItem(event, opts, needId) {
  const { auth } = opts;
  const { ddb, tableName } = auth;
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const description = validateString(body.description, "description", 1, 300);
  const need = await loadNeedWithGroup(ddb, tableName, needId);
  if (!need.group) throw err(400, "no_group");
  if (!need.groupMembers?.[auth.payload.sub]) throw err(403, "not_a_member");
  const result = await addGroupItem(ddb, tableName, { needId, description, actorSub: auth.payload.sub });
  return json(201, result);
}

export async function handlePostGroupItemClaim(event, opts, needId, itemId) {
  const { auth } = opts;
  const { ddb, tableName } = auth;
  const need = await loadNeedWithGroup(ddb, tableName, needId);
  if (!need.group) throw err(400, "no_group");
  if (!need.groupItems?.[itemId]) throw err(404, "item not found");
  const actorName = maskName(auth.user?.name || auth.payload.name || "");
  const result = await claimGroupItem(ddb, tableName, { needId, itemId, actorSub: auth.payload.sub, actorName });
  await putPointer(ddb, tableName, { sub: auth.payload.sub, type: "GROUP", id: needId });
  return json(200, result);
}

export async function handlePostGroupItemRelease(event, opts, needId, itemId) {
  const { auth } = opts;
  const { ddb, tableName } = auth;
  const need = await loadNeedWithGroup(ddb, tableName, needId);
  if (!need.group) throw err(400, "no_group");
  if (!need.groupItems?.[itemId]) throw err(404, "item not found");
  await releaseGroupItem(ddb, tableName, { needId, itemId, actorSub: auth.payload.sub });
  return json(200, { ok: true });
}

export async function handlePostGroupItemDone(event, opts, needId, itemId) {
  const { auth } = opts;
  const { ddb, tableName } = auth;
  const need = await loadNeedWithGroup(ddb, tableName, needId);
  if (!need.group) throw err(400, "no_group");
  if (!need.groupItems?.[itemId]) throw err(404, "item not found");
  const result = await markGroupItemDone(ddb, tableName, { needId, itemId, actorSub: auth.payload.sub });
  return json(200, result);
}
