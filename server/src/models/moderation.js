import { GetCommand, PutCommand, DeleteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { err } from "../lib/http.js";
import { validateString, validatePhone } from "../lib/validate.js";
import { generateClaimCode, maskName } from "../lib/format.js";
import { CATEGORIES, LANGUAGES } from "../constants.js";

export async function listPendingNeedsAndOffers(ddb, tableName) {
  let pending = [];
  for (const type of ["NEED", "OFFER"]) {
    const pk = `${type}#pending`;
    const res = await ddb.send(new QueryCommand({
      TableName: tableName,
      IndexName: "GSI2",
      KeyConditionExpression: "gsi2pk = :pk",
      ExpressionAttributeValues: { ":pk": pk },
      ScanIndexForward: true,
    }));
    if (res.Items) pending.push(...res.Items);
  }
  pending.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  return pending;
}

export async function listAllNeedsAllStatuses(ddb, tableName) {
  const allNeedStatuses = ["pending", "published", "matched", "fulfilled", "archived", "rejected"];
  let needsAll = [];
  for (const s of allNeedStatuses) {
    const res = await ddb.send(new QueryCommand({
      TableName: tableName,
      IndexName: "GSI2",
      KeyConditionExpression: "gsi2pk = :pk",
      ExpressionAttributeValues: { ":pk": `NEED#${s}` },
      ScanIndexForward: true,
    }));
    if (res.Items) needsAll.push(...res.Items);
  }
  return needsAll;
}

export function enrichWithDupCandidates(pending, needsAll) {
  return pending.map((it) => {
    let dupCandidates = [];
    if (it.type === "NEED" || it.PK.startsWith("NEED#")) {
      const name = (it.beneficiary?.name || "").trim().toLowerCase();
      const ward = it.beneficiary?.ward;
      dupCandidates = needsAll
        .filter((other) => other.id !== it.id && (other.beneficiary?.name || "").trim().toLowerCase() === name && other.beneficiary?.ward === ward)
        .map((other) => ({ id: other.id, maskedName: maskName(other.beneficiary?.name || ""), ward: other.beneficiary?.ward }));
    }
    return { ...it, dupCandidates };
  });
}

export async function getPendingItemByIdEitherType(ddb, tableName, id) {
  let item = (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `NEED#${id}`, SK: "META" } }))).Item;
  if (item) return { type: "NEED", item };
  item = (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `OFFER#${id}`, SK: "META" } }))).Item;
  if (item) return { type: "OFFER", item };
  return { type: null, item: null };
}

export function applyModerationEdits(type, item, edits) {
  if (edits.description !== undefined) item.description = validateString(edits.description, "edits.description", 10, 2000);
  if (edits.category !== undefined) {
    if (!CATEGORIES.includes(edits.category)) throw err(400, "invalid category in edits");
    item.category = edits.category;
  }
  if (edits.district !== undefined) {
    const d = validateString(edits.district, "edits.district", 1, 100);
    if (type === "NEED") {
      item.beneficiary = item.beneficiary || {};
      item.beneficiary.district = d;
    } else {
      if (Array.isArray(edits.districts)) {
        item.districts = edits.districts.map((x) => validateString(x, "edits.districts[]", 1, 100));
      }
    }
  }
  if (edits.ward !== undefined) {
    const w = edits.ward;
    if (typeof w !== "number" || !Number.isInteger(w) || w < 1 || w > 33) throw err(400, "edits.ward must be 1-33");
    if (type === "NEED") {
      item.beneficiary = item.beneficiary || {};
      item.beneficiary.ward = w;
    }
  }
  if (edits.beneficiary && typeof edits.beneficiary === "object" && type === "NEED") {
    if (edits.beneficiary.name !== undefined) item.beneficiary.name = validateString(edits.beneficiary.name, "edits.beneficiary.name", 1, 100);
    if (edits.beneficiary.phone !== undefined) item.beneficiary.phone = validatePhone(edits.beneficiary.phone, "edits.beneficiary.phone");
    if (edits.beneficiary.district !== undefined) item.beneficiary.district = validateString(edits.beneficiary.district, "edits.beneficiary.district", 1, 100);
    if (edits.beneficiary.ward !== undefined) {
      const w = edits.beneficiary.ward;
      if (typeof w !== "number" || !Number.isInteger(w) || w < 1 || w > 33) throw err(400, "edits.beneficiary.ward must be 1-33");
      item.beneficiary.ward = w;
    }
    if (edits.beneficiary.householdSize !== undefined) {
      const hs = edits.beneficiary.householdSize;
      if (hs !== null && (typeof hs !== "number" || !Number.isInteger(hs) || hs < 1 || hs > 30)) throw err(400, "edits.beneficiary.householdSize must be 1-30");
      if (hs === null) delete item.beneficiary.householdSize; else item.beneficiary.householdSize = hs;
    }
  }
  if (edits.categories !== undefined && type === "OFFER") {
    if (!Array.isArray(edits.categories) || edits.categories.length === 0) throw err(400, "edits.categories must be non-empty array");
    for (const c of edits.categories) if (!CATEGORIES.includes(c)) throw err(400, `invalid category ${c}`);
    item.categories = edits.categories;
  }
  if (edits.districts !== undefined && type === "OFFER") {
    if (!Array.isArray(edits.districts) || edits.districts.length === 0) throw err(400, "edits.districts must be non-empty array");
    item.districts = edits.districts.map((d) => validateString(d, "edits.districts[]", 1, 100));
  }
  if (edits.language !== undefined && type === "NEED") {
    if (!LANGUAGES.includes(edits.language)) throw err(400, "invalid language");
    item.language = edits.language;
  }
}

export async function moderatePendingItem(ddb, tableName, { id, type, item, action, reason }) {
  const newStatus = action === "publish" ? "published" : "rejected";
  item.status = newStatus;
  if (type === "NEED") {
    const district = item.beneficiary?.district || item.district || "";
    item.gsi1pk = `NEED#${district}#${newStatus}`;
    item.gsi1sk = item.createdAt;
    item.gsi2pk = `NEED#${newStatus}`;
    item.gsi2sk = item.createdAt;
  } else {
    const district = Array.isArray(item.districts) && item.districts[0] ? item.districts[0] : "";
    item.gsi1pk = `OFFER#${district}#${newStatus}`;
    item.gsi1sk = item.createdAt;
    item.gsi2pk = `OFFER#${newStatus}`;
    item.gsi2sk = item.createdAt;
  }
  if (newStatus === "rejected") {
    item.rejectReason = reason.trim();
  }
  let mintedClaimCode = null;
  if (type === "NEED" && newStatus === "published") {
    for (let tries = 0; tries < 5; tries++) {
      const code = generateClaimCode();
      const existing = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `CLAIM#${code}`, SK: "META" } })).catch(() => ({ Item: undefined }));
      if (!existing.Item) { mintedClaimCode = code; break; }
      if (tries === 4) throw err(500, "Failed to generate claimCode");
    }
    item.claimCode = mintedClaimCode;
  }
  await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
  if (type === "NEED" && newStatus === "rejected") {
    try {
      await ddb.send(new DeleteCommand({ TableName: tableName, Key: { PK: "FLAGGED", SK: id } }));
    } catch (_e) {}
  }
  if (mintedClaimCode) {
    const claimPtr = { PK: `CLAIM#${mintedClaimCode}`, SK: "META", type: "CLAIM", claimCode: mintedClaimCode, needId: id, createdAt: new Date().toISOString() };
    await ddb.send(new PutCommand({ TableName: tableName, Item: claimPtr }));
  }
  return { status: newStatus, claimCode: mintedClaimCode };
}
