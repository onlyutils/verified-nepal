import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { err } from "../lib/http.js";

export async function getUserProfile(ddb, tableName, sub) {
  try {
    const res = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `USER#${sub}`, SK: "PROFILE" } }));
    return { ok: true, item: res.Item };
  } catch (e) {
    try { console.error({ tag: "ddb_fail", op: "GetCommand", message: e instanceof Error ? e.message : String(e) }); } catch (_e) {}
    return { ok: false };
  }
}

export async function createUserProfile(ddb, tableName, item) {
  try {
    await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
    return { ok: true };
  } catch (e) {
    try { console.error({ tag: "ddb_fail", op: "PutCommand", message: e instanceof Error ? e.message : String(e) }); } catch (_e) {}
    return { ok: false };
  }
}

export async function saveUserProfile(ddb, tableName, user) {
  await ddb.send(new PutCommand({ TableName: tableName, Item: user }));
}

export async function createEmailPointer(ddb, tableName, { sub, email, createdAt }) {
  const lower = String(email).toLowerCase();
  try {
    await ddb.send(new PutCommand({ TableName: tableName, Item: { PK: `EMAIL#${lower}`, SK: "META", type: "EMAIL", sub, email, createdAt } }));
  } catch (_e) {}
}

export async function getEmailPointer(ddb, tableName, email) {
  const lower = String(email).toLowerCase();
  const res = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `EMAIL#${lower}`, SK: "META" } }));
  return res.Item;
}

export async function ensureUserBackfill({ ddb, tableName, user, payload }) {
  if (!user) return;
  let needsUpdate = false;
  const clone = { ...user };
  if (!Array.isArray(clone.districts)) { clone.districts = []; needsUpdate = true; }
  const expectedGsi2pk = `USER#${clone.role}`;
  if (clone.gsi2pk !== expectedGsi2pk) { clone.gsi2pk = expectedGsi2pk; needsUpdate = true; }
  if (!clone.gsi2sk && clone.createdAt) { clone.gsi2sk = clone.createdAt; needsUpdate = true; }
  if (!clone.gsi2sk && !clone.createdAt) { clone.gsi2sk = new Date().toISOString(); clone.createdAt = clone.gsi2sk; needsUpdate = true; }
  if (needsUpdate) {
    try { await ddb.send(new PutCommand({ TableName: tableName, Item: clone })); } catch (_e) {}
    Object.assign(user, clone);
  }
  if (user.email) {
    const lower = String(user.email).toLowerCase();
    const pk = `EMAIL#${lower}`;
    try {
      const res = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: pk, SK: "META" } }));
      if (!res.Item) {
        await ddb.send(new PutCommand({ TableName: tableName, Item: { PK: pk, SK: "META", type: "EMAIL", sub: user.sub || payload.sub, email: user.email, createdAt: user.createdAt || new Date().toISOString() } }));
      }
    } catch (_e) {}
  }
}

export async function listUsersByRoles(ddb, tableName, roles) {
  let all = [];
  for (const r of roles) {
    const pk = `USER#${r}`;
    const res = await ddb.send(new QueryCommand({ TableName: tableName, IndexName: "GSI2", KeyConditionExpression: "gsi2pk = :pk", ExpressionAttributeValues: { ":pk": pk }, ScanIndexForward: true }));
    if (res.Items) all.push(...res.Items);
  }
  all.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return all;
}

export async function setUserRole(ddb, tableName, { actorSub, targetSub, role, districts }) {
  const user = (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `USER#${targetSub}`, SK: "PROFILE" } }))).Item;
  if (!user) throw err(404, "not found");
  if (actorSub === targetSub && user.role === "admin" && role !== "admin") throw err(403, "self_demotion_not_allowed");
  user.role = role;
  user.districts = districts;
  user.gsi2pk = `USER#${role}`;
  user.gsi2sk = user.createdAt || new Date().toISOString();
  if (!user.createdAt) user.createdAt = user.gsi2sk;
  await ddb.send(new PutCommand({ TableName: tableName, Item: user }));
  return user;
}
