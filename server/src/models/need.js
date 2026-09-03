import { randomUUID } from "node:crypto";
import { GetCommand, PutCommand, DeleteCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { err } from "../lib/http.js";
import { ttlSeconds, toExpiresAt, generateRefCode } from "../lib/format.js";
import { PUBLIC_NEED_STATUSES } from "../constants.js";

export async function createNeed(ddb, tableName, {
  onBehalf, regName, regPhone, regEmail,
  benName, benPhone, benEmail, district, ward, householdSize,
  category, description, language, media,
}) {
  const id = randomUUID();
  let refCode;
  for (let tries = 0; tries < 5; tries++) {
    refCode = generateRefCode();
    const existing = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `REF#${refCode}`, SK: "META" } })).catch(() => ({ Item: undefined }));
    if (!existing.Item) break;
    if (tries === 4) throw err(500, "Failed to generate refCode");
  }
  const createdAt = new Date().toISOString();
  const ttl = ttlSeconds(30);
  const expiresAt = toExpiresAt(ttl);
  const status = "pending";
  const item = {
    PK: `NEED#${id}`,
    SK: "META",
    type: "NEED",
    id,
    refCode,
    onBehalf,
    registrant: onBehalf ? { name: regName, phone: regPhone, email: regEmail } : (regName || regPhone || regEmail ? { name: regName, phone: regPhone, email: regEmail } : undefined),
    beneficiary: { name: benName, phone: benPhone, email: benEmail, district, ward, householdSize },
    category,
    description,
    language,
    media: media && media.length ? media : undefined,
    status,
    createdAt,
    ttl,
    expiresAt,
    gsi1pk: `NEED#${district}#${status}`,
    gsi1sk: createdAt,
    gsi2pk: `NEED#${status}`,
    gsi2sk: createdAt,
  };
  if (!item.registrant) delete item.registrant;
  if (item.registrant && !item.registrant.name) delete item.registrant.name;
  if (item.registrant && !item.registrant.phone) delete item.registrant.phone;
  if (item.registrant && !item.registrant.email) delete item.registrant.email;
  if (item.beneficiary.householdSize === undefined) delete item.beneficiary.householdSize;
  if (!item.beneficiary.phone) delete item.beneficiary.phone;
  if (!item.beneficiary.email) delete item.beneficiary.email;
  if (!item.media) delete item.media;
  const refItem = { PK: `REF#${refCode}`, SK: "META", type: "REF", refCode, needId: id, ttl, createdAt };
  await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
  await ddb.send(new PutCommand({ TableName: tableName, Item: refItem }));
  return { id, refCode };
}

export async function listPublicNeeds(ddb, tableName, { district, category }) {
  let items = [];
  if (district) {
    for (const status of PUBLIC_NEED_STATUSES) {
      const pk = `NEED#${district}#${status}`;
      const res = await ddb.send(new QueryCommand({
        TableName: tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "gsi1pk = :pk",
        ExpressionAttributeValues: { ":pk": pk },
        ScanIndexForward: false,
      }));
      if (res.Items) items.push(...res.Items);
    }
  } else {
    for (const status of PUBLIC_NEED_STATUSES) {
      const pk = `NEED#${status}`;
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
  if (category) items = items.filter((it) => it.category === category);
  items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return items;
}

export async function getRefPointer(ddb, tableName, refCode) {
  return (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `REF#${refCode}`, SK: "META" } }))).Item;
}

export async function getNeedById(ddb, tableName, id) {
  return (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `NEED#${id}`, SK: "META" } }))).Item;
}

export async function putNeed(ddb, tableName, need) {
  await ddb.send(new PutCommand({ TableName: tableName, Item: need }));
}

export async function renewNeed(ddb, tableName, { ref, need }) {
  const newTtl = ttlSeconds(30);
  const newExpiresAt = toExpiresAt(newTtl);
  need.ttl = newTtl;
  need.expiresAt = newExpiresAt;
  ref.ttl = newTtl;
  await ddb.send(new PutCommand({ TableName: tableName, Item: need }));
  await ddb.send(new PutCommand({ TableName: tableName, Item: ref }));
  return newExpiresAt;
}

export async function setNeedStatus(ddb, tableName, { need, status, offerId }) {
  need.status = status;
  const district = need.beneficiary?.district || need.district || "";
  need.gsi1pk = `NEED#${district}#${status}`;
  need.gsi1sk = need.createdAt;
  need.gsi2pk = `NEED#${status}`;
  need.gsi2sk = need.createdAt;
  if (offerId) need.matchedOfferId = offerId;
  await ddb.send(new PutCommand({ TableName: tableName, Item: need }));
  if (status === "archived" || status === "rejected") {
    try {
      await ddb.send(new DeleteCommand({ TableName: tableName, Key: { PK: "FLAGGED", SK: need.id } }));
    } catch (_e) {}
  }
}

export async function getOfferById(ddb, tableName, offerId) {
  return (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `OFFER#${offerId}`, SK: "META" } }))).Item;
}

export async function addFlag(ddb, tableName, { needId, reason, details }) {
  const nowIso = new Date().toISOString();
  const flagItem = { PK: `NEED#${needId}`, SK: `FLAG#${nowIso}#${randomUUID().slice(0, 8)}`, type: "FLAG", needId, reason, details, createdAt: nowIso };
  if (!flagItem.details) delete flagItem.details;
  await ddb.send(new PutCommand({ TableName: tableName, Item: flagItem }));
  return nowIso;
}

export async function bumpFlagCount(ddb, tableName, need) {
  // Atomic increment so a concurrent moderator write (e.g. publish) is not
  // clobbered by a whole-item Put racing the flag bump.
  const res = await ddb.send(new UpdateCommand({
    TableName: tableName,
    Key: { PK: need.PK, SK: need.SK },
    UpdateExpression: "ADD flagCount :one",
    ExpressionAttributeValues: { ":one": 1 },
    ReturnValues: "ALL_NEW",
  }));
  const count = res.Attributes?.flagCount ?? ((need.flagCount || 0) + 1);
  need.flagCount = count;
  return count;
}

export async function upsertFlaggedPointer(ddb, tableName, { needId, flagCount, maskedName, district, ward }) {
  const pointer = {
    PK: "FLAGGED",
    SK: needId,
    type: "FLAGGED",
    needId,
    flagCount,
    maskedName,
    district,
    ward,
    updatedAt: new Date().toISOString(),
  };
  await ddb.send(new PutCommand({ TableName: tableName, Item: pointer }));
}

export async function listFlaggedPointers(ddb, tableName) {
  const pointers = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": "FLAGGED" },
        ...(ExclusiveStartKey ? { ExclusiveStartKey } : {}),
      }),
    );
    if (res.Items) pointers.push(...res.Items);
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  // The FLAGGED partition also holds center-flag pointers (SK begins with "CENTER#"),
  // which lack need fields (maskedName) and crash the need-flags sort. Exclude them here.
  return pointers.filter((p) => !(typeof p.SK === "string" && p.SK.startsWith("CENTER#")));
}

export async function listFlagsForNeed(ddb, tableName, needId) {
  const flagRes = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": `NEED#${needId}`, ":prefix": "FLAG#" },
    }),
  );
  return (flagRes.Items || [])
    .map((f) => ({ reason: f.reason, details: f.details, createdAt: f.createdAt }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function listNeedsByDistrictStatuses(ddb, tableName, district, statuses) {
  let items = [];
  for (const status of statuses) {
    const pk = `NEED#${district}#${status}`;
    const res = await ddb.send(new QueryCommand({ TableName: tableName, IndexName: "GSI1", KeyConditionExpression: "gsi1pk = :pk", ExpressionAttributeValues: { ":pk": pk } }));
    if (res.Items) items.push(...res.Items);
  }
  return items;
}
