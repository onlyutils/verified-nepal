import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { verifyIdToken } from "./verify.js";
import { randomBytes, randomUUID } from "node:crypto";

const CATEGORIES = ["goods", "shelter", "transport", "medical", "skilled-labor", "funds-guidance"];
const LANGUAGES = ["en", "ne"];
const PUBLIC_NEED_STATUSES = ["published", "matched", "fulfilled"];
const PUBLIC_OFFER_STATUSES = ["published", "matched", "fulfilled"];
const MOD_STATUS = ["matched", "fulfilled", "archived"];
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function json(status, body) {
  return {
    statusCode: status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function getAuthToken(headers) {
  if (!headers) return null;
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === "authorization") return v;
  }
  return null;
}

function getQuery(event) {
  const q = {};
  if (event.queryStringParameters && typeof event.queryStringParameters === "object") {
    Object.assign(q, event.queryStringParameters);
  }
  const raw = event.rawPath ?? event.path ?? "";
  const idx = raw.indexOf("?");
  if (idx !== -1) {
    const qs = raw.slice(idx + 1);
    const params = new URLSearchParams(qs);
    for (const [k, v] of params) if (!(k in q)) q[k] = v;
  }
  if (event.query && typeof event.query === "object") Object.assign(q, event.query);
  return q;
}

function parseBody(event) {
  if (event.body === undefined || event.body === null) return null;
  if (typeof event.body === "object" && !(event.body instanceof Buffer) && !(event.body instanceof Uint8Array)) return event.body;
  const str = typeof event.body === "string" ? event.body : Buffer.from(event.body).toString("utf8");
  if (!str.trim()) return null;
  try {
    return JSON.parse(str);
  } catch {
    const e = new Error("Invalid JSON");
    e.status = 400;
    throw e;
  }
}

function maskName(name) {
  if (!name || typeof name !== "string") return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first} ${last[0].toUpperCase()}.`;
}

function generateRefCode() {
  const bytes = randomBytes(9);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out.slice(0, 12);
}

function ttlSeconds(days = 30) {
  return Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
}

function toExpiresAt(ttl) {
  return new Date(ttl * 1000).toISOString();
}

function err(status, msg) {
  const e = new Error(msg);
  e.status = status;
  return e;
}

function validateString(v, name, min, max) {
  if (typeof v !== "string") throw err(400, `${name} must be a string`);
  const t = v.trim();
  if (t.length < min) throw err(400, `${name} must be at least ${min} characters`);
  if (t.length > max) throw err(400, `${name} must be at most ${max} characters`);
  return t;
}

function validateOptionalString(v, name, min, max) {
  if (v === undefined || v === null) return undefined;
  return validateString(v, name, min, max);
}

function validatePhone(v, name = "phone") {
  if (typeof v !== "string") throw err(400, `${name} must be a string`);
  const t = v.trim();
  if (t.length < 5 || t.length > 30) throw err(400, `${name} must be 5-30 characters`);
  if (!/^\+?[0-9\-\s()]+$/.test(t)) throw err(400, `${name} contains invalid characters`);
  return t;
}

async function verifyTurnstile(token, secret) {
  if (!secret) return;
  if (!token || typeof token !== "string" || !token.trim()) throw err(400, "turnstile token required");
  const params = new URLSearchParams();
  params.set("secret", secret);
  params.set("response", token);
  let res;
  try {
    res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: params,
    });
  } catch {
    throw err(400, "turnstile verification failed");
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw err(400, "turnstile verification failed");
  }
  if (!data.success) throw err(400, "turnstile verification failed");
}

function encodeCursor(key) {
  if (!key) return undefined;
  return Buffer.from(JSON.stringify(key)).toString("base64url");
}
function decodeCursor(cur) {
  if (!cur) return null;
  try {
    const s = Buffer.from(String(cur), "base64url").toString("utf8");
    const obj = JSON.parse(s);
    if (!obj || typeof obj !== "object" || typeof obj.PK !== "string" || typeof obj.SK !== "string") throw new Error();
    return obj;
  } catch {
    throw err(400, "invalid cursor");
  }
}

async function handleMe(event, { fetchJwks, getDdb, env }) {
  const auth = getAuthToken(event.headers);
  if (!auth || !auth.startsWith("Bearer ")) throw err(401, "Missing or invalid Authorization header");
  const token = auth.slice("Bearer ".length).trim();
  if (!token) throw err(401, "Missing token");
  let payload;
  try {
    payload = await verifyIdToken(token, { fetchJwks, env });
  } catch (e) {
    if (e.status === 500) throw e;
    const ne = new Error(e.message || "Invalid token");
    ne.status = 401;
    throw ne;
  }
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  const pk = `USER#${payload.sub}`;
  const sk = "PROFILE";
  let existing;
  try {
    const res = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: pk, SK: sk } }));
    existing = res.Item;
  } catch {
    throw err(500, "Failed to read user");
  }
  let role;
  let email = payload.email ?? "";
  let name = payload.name ?? "";
  if (existing) {
    role = existing.role;
    if (existing.email) email = existing.email;
    if (existing.name) name = existing.name;
  } else {
    const adminEmails = (env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const moderatorEmails = (env.MODERATOR_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const emailLower = (payload.email || "").toLowerCase();
    if (adminEmails.includes(emailLower)) role = "admin";
    else if (moderatorEmails.includes(emailLower)) role = "moderator";
    else role = "helper";
    const item = { PK: pk, SK: sk, type: "USER", sub: payload.sub, email, name: payload.name || "", role, createdAt: new Date().toISOString() };
    try {
      await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
    } catch {
      throw err(500, "Failed to create user");
    }
    return json(200, { sub: payload.sub, email, name: payload.name || "", role });
  }
  return json(200, { sub: payload.sub, email, name, role });
}

async function requireAuth(event, { fetchJwks, getDdb, env }) {
  const auth = getAuthToken(event.headers);
  if (!auth || !auth.startsWith("Bearer ")) throw err(401, "Missing or invalid Authorization header");
  const token = auth.slice("Bearer ".length).trim();
  if (!token) throw err(401, "Missing token");
  let payload;
  try {
    payload = await verifyIdToken(token, { fetchJwks, env });
  } catch (e) {
    if (e.status === 500) throw e;
    const ne = new Error(e.message || "Invalid token");
    ne.status = 401;
    throw ne;
  }
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  const pk = `USER#${payload.sub}`;
  const sk = "PROFILE";
  let user;
  try {
    const res = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: pk, SK: sk } }));
    user = res.Item;
  } catch {
    throw err(500, "Failed to read user");
  }
  let role = user?.role;
  if (!user) {
    role = "helper";
  }
  return { payload, user, role, ddb, tableName };
}

async function handlePostNeeds(event, { getDdb, env }) {
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { onBehalf, registrant, beneficiary, category, description, language, turnstileToken } = body;
  if (typeof onBehalf !== "boolean") throw err(400, "onBehalf must be boolean");
  let regName, regPhone;
  if (onBehalf) {
    if (!registrant || typeof registrant !== "object") throw err(400, "registrant required when onBehalf is true");
    regName = validateString(registrant.name, "registrant.name", 1, 100);
    regPhone = validatePhone(registrant.phone, "registrant.phone");
  } else if (registrant !== undefined && registrant !== null) {
    if (typeof registrant !== "object") throw err(400, "registrant must be object");
    if (registrant.name !== undefined) regName = validateString(registrant.name, "registrant.name", 1, 100);
    if (registrant.phone !== undefined) regPhone = validatePhone(registrant.phone, "registrant.phone");
  }
  if (!beneficiary || typeof beneficiary !== "object") throw err(400, "beneficiary required");
  const benName = validateString(beneficiary.name, "beneficiary.name", 1, 100);
  let benPhone;
  if (beneficiary.phone !== undefined && beneficiary.phone !== null && String(beneficiary.phone).trim() !== "") {
    benPhone = validatePhone(beneficiary.phone, "beneficiary.phone");
  }
  const district = validateString(beneficiary.district, "beneficiary.district", 1, 100);
  const ward = beneficiary.ward;
  if (typeof ward !== "number" || !Number.isInteger(ward) || ward < 1 || ward > 33) throw err(400, "beneficiary.ward must be integer 1-33");
  let householdSize;
  if (beneficiary.householdSize !== undefined && beneficiary.householdSize !== null) {
    if (typeof beneficiary.householdSize !== "number" || !Number.isInteger(beneficiary.householdSize) || beneficiary.householdSize < 1 || beneficiary.householdSize > 30) throw err(400, "beneficiary.householdSize must be integer 1-30");
    householdSize = beneficiary.householdSize;
  }
  if (!CATEGORIES.includes(category)) throw err(400, `category must be one of ${CATEGORIES.join(",")}`);
  const desc = validateString(description, "description", 10, 2000);
  if (!LANGUAGES.includes(language)) throw err(400, 'language must be "en" or "ne"');
  await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET);
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  let id = randomUUID();
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
  const gsi1pk = `NEED#${district}#${status}`;
  const gsi1sk = createdAt;
  const gsi2pk = `NEED#${status}`;
  const gsi2sk = createdAt;
  const item = {
    PK: `NEED#${id}`,
    SK: "META",
    type: "NEED",
    id,
    refCode,
    onBehalf,
    registrant: onBehalf ? { name: regName, phone: regPhone } : (regName || regPhone ? { name: regName, phone: regPhone } : undefined),
    beneficiary: { name: benName, phone: benPhone, district, ward, householdSize },
    category,
    description: desc,
    language,
    status,
    createdAt,
    ttl,
    expiresAt,
    gsi1pk,
    gsi1sk,
    gsi2pk,
    gsi2sk,
  };
  if (!item.registrant) delete item.registrant;
  if (item.registrant && !item.registrant.name) delete item.registrant.name;
  if (item.registrant && !item.registrant.phone) delete item.registrant.phone;
  if (item.beneficiary.householdSize === undefined) delete item.beneficiary.householdSize;
  if (!item.beneficiary.phone) delete item.beneficiary.phone;
  const refItem = { PK: `REF#${refCode}`, SK: "META", type: "REF", refCode, needId: id, ttl, createdAt };
  await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
  await ddb.send(new PutCommand({ TableName: tableName, Item: refItem }));
  return json(201, { id, refCode });
}

async function handleGetNeeds(event, { getDdb, env }) {
  const q = getQuery(event);
  const district = q.district ? String(q.district).trim() : "";
  const category = q.category ? String(q.category).trim() : "";
  const cursorRaw = q.cursor ? String(q.cursor) : "";
  if (category && !CATEGORIES.includes(category)) throw err(400, `category must be one of ${CATEGORIES.join(",")}`);
  const cursorKey = decodeCursor(cursorRaw);
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
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
  let start = 0;
  if (cursorKey) {
    const idx = items.findIndex((it) => it.PK === cursorKey.PK && it.SK === cursorKey.SK);
    if (idx === -1) throw err(400, "invalid cursor");
    start = idx + 1;
  }
  const limit = 20;
  const sliced = items.slice(start, start + limit);
  const publicItems = sliced.map((it) => ({
    id: it.id,
    maskedName: maskName(it.beneficiary?.name || it.name || ""),
    district: it.beneficiary?.district || it.district || "",
    ward: it.beneficiary?.ward ?? it.ward,
    category: it.category,
    description: it.description,
    status: it.status,
    createdAt: it.createdAt,
  }));
  const body = { items: publicItems };
  if (start + limit < items.length) {
    const last = sliced[sliced.length - 1];
    body.cursor = encodeCursor({ PK: last.PK, SK: last.SK });
  }
  return json(200, body);
}

async function handleGetStatus(event, { getDdb, env }, refCode) {
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  const ref = (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `REF#${refCode}`, SK: "META" } }))).Item;
  if (!ref) throw err(404, "not found");
  const need = (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `NEED#${ref.needId}`, SK: "META" } }))).Item;
  if (!need) throw err(404, "not found");
  return json(200, {
    status: need.status,
    category: need.category,
    district: need.beneficiary?.district || need.district,
    createdAt: need.createdAt,
    expiresAt: need.expiresAt || toExpiresAt(need.ttl),
  });
}

async function handlePostRenew(event, { getDdb, env }, refCode) {
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  const ref = (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `REF#${refCode}`, SK: "META" } }))).Item;
  if (!ref) throw err(404, "not found");
  const needKey = { PK: `NEED#${ref.needId}`, SK: "META" };
  const need = (await ddb.send(new GetCommand({ TableName: tableName, Key: needKey }))).Item;
  if (!need) throw err(404, "not found");
  const newTtl = ttlSeconds(30);
  const newExpiresAt = toExpiresAt(newTtl);
  need.ttl = newTtl;
  need.expiresAt = newExpiresAt;
  ref.ttl = newTtl;
  await ddb.send(new PutCommand({ TableName: tableName, Item: need }));
  await ddb.send(new PutCommand({ TableName: tableName, Item: ref }));
  return json(200, { expiresAt: newExpiresAt });
}

async function handlePostOffers(event, { fetchJwks, getDdb, env }) {
  const auth = await requireAuth(event, { fetchJwks, getDdb, env });
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { org, categories, districts, description, phone } = body;
  if (!Array.isArray(categories) || categories.length === 0) throw err(400, "categories must be non-empty array");
  for (const c of categories) if (!CATEGORIES.includes(c)) throw err(400, `invalid category ${c}`);
  if (!Array.isArray(districts) || districts.length === 0) throw err(400, "districts must be non-empty array");
  const cleanDistricts = districts.map((d) => validateString(d, "districts[]", 1, 100));
  const desc = validateString(description, "description", 10, 2000);
  const cleanPhone = validatePhone(phone, "phone");
  let cleanOrg;
  if (org !== undefined && org !== null) {
    if (typeof org !== "object") throw err(400, "org must be object");
    const name = validateString(org.name, "org.name", 1, 100);
    const contact = validateString(org.contact, "org.contact", 1, 200);
    cleanOrg = { name, contact };
  }
  const tableName = auth.tableName;
  const ddb = auth.ddb;
  const helperSub = auth.payload.sub;
  const helperName = auth.user?.name || auth.payload.name || "Helper";
  const helperLabel = maskName(helperName);
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const ttl = ttlSeconds(30);
  const expiresAt = toExpiresAt(ttl);
  const status = "pending";
  const gsi1pk = `OFFER#${cleanDistricts[0]}#${status}`;
  const gsi1sk = createdAt;
  const gsi2pk = `OFFER#${status}`;
  const gsi2sk = createdAt;
  const item = {
    PK: `OFFER#${id}`,
    SK: "META",
    type: "OFFER",
    id,
    helperSub,
    helperLabel,
    org: cleanOrg,
    categories,
    districts: cleanDistricts,
    description: desc,
    phone: cleanPhone,
    status,
    createdAt,
    ttl,
    expiresAt,
    gsi1pk,
    gsi1sk,
    gsi2pk,
    gsi2sk,
  };
  if (!cleanOrg) delete item.org;
  await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
  return json(201, { id });
}

async function handleGetOffers(event, { getDdb, env }) {
  const q = getQuery(event);
  const district = q.district ? String(q.district).trim() : "";
  const category = q.category ? String(q.category).trim() : "";
  const cursorRaw = q.cursor ? String(q.cursor) : "";
  if (category && !CATEGORIES.includes(category)) throw err(400, `category must be one of ${CATEGORIES.join(",")}`);
  const cursorKey = decodeCursor(cursorRaw);
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  let items = [];
  if (district) {
    for (const status of PUBLIC_OFFER_STATUSES) {
      const pk = `OFFER#${district}#${status}`;
      const res = await ddb.send(new QueryCommand({
        TableName: tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "gsi1pk = :pk",
        ExpressionAttributeValues: { ":pk": pk },
        ScanIndexForward: false,
      }));
      if (res.Items) items.push(...res.Items);
    }
    items = items.filter((it) => Array.isArray(it.districts) && it.districts.includes(district));
  } else {
    for (const status of PUBLIC_OFFER_STATUSES) {
      const pk = `OFFER#${status}`;
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
  if (category) items = items.filter((it) => Array.isArray(it.categories) && it.categories.includes(category));
  items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  let start = 0;
  if (cursorKey) {
    const idx = items.findIndex((it) => it.PK === cursorKey.PK && it.SK === cursorKey.SK);
    if (idx === -1) throw err(400, "invalid cursor");
    start = idx + 1;
  }
  const limit = 20;
  const sliced = items.slice(start, start + limit);
  const publicItems = sliced.map((it) => {
    const o = { id: it.id, helperLabel: it.helperLabel || maskName(it.helperName || ""), categories: it.categories, districts: it.districts, description: it.description, status: it.status, createdAt: it.createdAt };
    if (it.org) o.org = it.org;
    return o;
  });
  const body = { items: publicItems };
  if (start + limit < items.length) {
    const last = sliced[sliced.length - 1];
    body.cursor = encodeCursor({ PK: last.PK, SK: last.SK });
  }
  return json(200, body);
}

async function handleGetModerationQueue(event, opts) {
  const auth = await requireAuth(event, opts);
  if (!["moderator", "admin"].includes(auth.role)) throw err(403, "Forbidden");
  const tableName = auth.tableName;
  const ddb = auth.ddb;
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
  if (needsAll.length === 0) {
    // fallback: if GSI queries missed items due to missing gsi2pk (e.g., legacy data), try direct scan via Query fallback? Use pending as needsAll source if still empty
    needsAll = pending.filter((it) => it.PK.startsWith("NEED#"));
  }
  const enriched = pending.map((it) => {
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
  return json(200, { items: enriched });
}

async function handlePostModeration(event, opts, id) {
  const auth = await requireAuth(event, opts);
  if (!["moderator", "admin"].includes(auth.role)) throw err(403, "Forbidden");
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { action, reason, edits } = body;
  if (!["publish", "reject"].includes(action)) throw err(400, 'action must be "publish" or "reject"');
  if (action === "reject") {
    if (!reason || typeof reason !== "string" || !reason.trim() || reason.trim().length < 5) throw err(400, "reason required for reject");
    if (reason.trim().length > 1000) throw err(400, "reason too long");
  }
  const tableName = auth.tableName;
  const ddb = auth.ddb;
  let item = (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `NEED#${id}`, SK: "META" } }))).Item;
  let type = "NEED";
  if (!item) {
    item = (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `OFFER#${id}`, SK: "META" } }))).Item;
    type = "OFFER";
  }
  if (!item) throw err(404, "not found");
  if (item.status !== "pending") throw err(400, "only pending items can be moderated");
  if (edits && typeof edits === "object") {
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
  await ddb.send(new PutCommand({ TableName: tableName, Item: item }));
  const nowIso = new Date().toISOString();
  const ym = nowIso.slice(0, 7);
  const audit = {
    PK: `AUDIT#${ym}`,
    SK: `${nowIso}#${auth.payload.sub}`,
    type: "AUDIT",
    action,
    targetId: id,
    targetType: type,
    actorSub: auth.payload.sub,
    actorEmail: auth.payload.email || auth.user?.email || "",
    reason: reason ? reason.trim() : undefined,
    edits: edits || undefined,
    createdAt: nowIso,
  };
  if (!audit.reason) delete audit.reason;
  if (!audit.edits) delete audit.edits;
  await ddb.send(new PutCommand({ TableName: tableName, Item: audit }));
  return json(200, { status: newStatus });
}

async function handlePostNeedStatus(event, opts, needId) {
  const auth = await requireAuth(event, opts);
  if (!["moderator", "admin"].includes(auth.role)) throw err(403, "Forbidden");
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { status, offerId } = body;
  if (!MOD_STATUS.includes(status)) throw err(400, `status must be one of ${MOD_STATUS.join(",")}`);
  const tableName = auth.tableName;
  const ddb = auth.ddb;
  const need = (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `NEED#${needId}`, SK: "META" } }))).Item;
  if (!need) throw err(404, "not found");
  if (need.status === "pending" || need.status === "rejected") throw err(400, "need must be published before status update");
  need.status = status;
  const district = need.beneficiary?.district || need.district || "";
  need.gsi1pk = `NEED#${district}#${status}`;
  need.gsi1sk = need.createdAt;
  need.gsi2pk = `NEED#${status}`;
  need.gsi2sk = need.createdAt;
  if (offerId) need.matchedOfferId = offerId;
  await ddb.send(new PutCommand({ TableName: tableName, Item: need }));
  const nowIso = new Date().toISOString();
  const ym = nowIso.slice(0, 7);
  const audit = {
    PK: `AUDIT#${ym}`,
    SK: `${nowIso}#${auth.payload.sub}`,
    type: "AUDIT",
    action: `status:${status}`,
    targetId: needId,
    targetType: "NEED",
    actorSub: auth.payload.sub,
    createdAt: nowIso,
    status,
    offerId: offerId || undefined,
  };
  if (!audit.offerId) delete audit.offerId;
  await ddb.send(new PutCommand({ TableName: tableName, Item: audit }));
  if (status === "matched") {
    let offer = null;
    if (offerId) {
      offer = (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `OFFER#${offerId}`, SK: "META" } }))).Item;
    }
    const contact = {
      beneficiary: {
        name: need.beneficiary?.name,
        phone: need.beneficiary?.phone || null,
        district: need.beneficiary?.district,
        ward: need.beneficiary?.ward,
      },
      registrant: need.registrant ? { name: need.registrant.name, phone: need.registrant.phone } : null,
      offer: offer ? { phone: offer.phone, helperLabel: offer.helperLabel, org: offer.org || null, categories: offer.categories, districts: offer.districts } : null,
    };
    return json(200, { status, contact });
  }
  return json(200, { status });
}


function getTokenEndpoint(env) {
  const host = (env.AUTH_HOST || "https://auth.onlyutils.com").replace(/\/+$/, "");
  return `${host}/token`;
}

async function handleAuthExchange(event, { env, fetchImpl }) {
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { code, code_verifier, redirect_uri } = body;
  if (!code || typeof code !== "string" || !code.trim()) throw err(400, "code required");
  if (!code_verifier || typeof code_verifier !== "string" || !code_verifier.trim()) throw err(400, "code_verifier required");
  if (!redirect_uri || typeof redirect_uri !== "string" || !redirect_uri.trim()) throw err(400, "redirect_uri required");
  const endpoint = getTokenEndpoint(env);
  const params = new URLSearchParams();
  params.set("grant_type", "authorization_code");
  params.set("code", code);
  params.set("code_verifier", code_verifier);
  params.set("redirect_uri", redirect_uri);
  if (env.OU_CLIENT_ID) params.set("client_id", env.OU_CLIENT_ID);
  if (env.OU_CLIENT_SECRET) params.set("client_secret", env.OU_CLIENT_SECRET);
  let res;
  try {
    res = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch {
    throw err(400, "token exchange failed");
  }
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (res.ok) {
    return json(200, data);
  }
  const msg = data?.error_description || data?.error || data?.message || `upstream error ${res.status}`;
  const e = new Error(msg);
  e.status = 400;
  throw e;
}

async function handleAuthRefresh(event, { env, fetchImpl }) {
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { refresh_token } = body;
  if (!refresh_token || typeof refresh_token !== "string" || !refresh_token.trim()) throw err(400, "refresh_token required");
  const endpoint = getTokenEndpoint(env);
  const params = new URLSearchParams();
  params.set("grant_type", "refresh_token");
  params.set("refresh_token", refresh_token);
  if (env.OU_CLIENT_ID) params.set("client_id", env.OU_CLIENT_ID);
  if (env.OU_CLIENT_SECRET) params.set("client_secret", env.OU_CLIENT_SECRET);
  let res;
  try {
    res = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch {
    throw err(400, "token refresh failed");
  }
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (res.ok) {
    return json(200, data);
  }
  const msg = data?.error_description || data?.error || data?.message || `upstream error ${res.status}`;
  const e = new Error(msg);
  e.status = 400;
  throw e;
}

export function createHandler(opts = {}) {
  const env = opts.env ?? process.env;
  const fetchJwks = opts.fetchJwks;
  const fetchImpl = opts.fetch ?? opts.fetchImpl ?? globalThis.fetch;
  let ddbClient = opts.ddbClient ?? null;
  function getDdb() {
    if (ddbClient) return ddbClient;
    const client = new DynamoDBClient({});
    ddbClient = DynamoDBDocumentClient.from(client);
    return ddbClient;
  }
  return async (event) => {
    try {
      const method = (event.requestContext?.http?.method ?? event.requestContext?.httpMethod ?? event.httpMethod ?? "GET").toUpperCase();
      const rawPathFull = event.rawPath ?? event.requestContext?.http?.path ?? event.path ?? "/";
      const path = rawPathFull.split("?")[0];
      if (method === "OPTIONS") return { statusCode: 204, headers: {}, body: "" };
      if (method === "GET" && path === "/health") return json(200, { ok: true });
      if (method === "POST" && path === "/auth/exchange") return await handleAuthExchange(event, { env, fetchImpl });
      if (method === "POST" && path === "/auth/refresh") return await handleAuthRefresh(event, { env, fetchImpl });
      if (method === "GET" && path === "/me") return await handleMe(event, { fetchJwks, getDdb, env });
      if (method === "POST" && path === "/needs") return await handlePostNeeds(event, { getDdb, env });
      if (method === "GET" && path === "/needs") return await handleGetNeeds(event, { getDdb, env });
      if (method === "GET" && path.startsWith("/status/")) {
        const ref = decodeURIComponent(path.slice("/status/".length));
        if (!ref) throw err(400, "refCode required");
        return await handleGetStatus(event, { getDdb, env }, ref);
      }
      if (method === "POST" && /^\/needs\/[^\/]+\/renew$/.test(path)) {
        const ref = decodeURIComponent(path.split("/")[2]);
        return await handlePostRenew(event, { getDdb, env }, ref);
      }
      if (method === "POST" && path === "/offers") return await handlePostOffers(event, { fetchJwks, getDdb, env });
      if (method === "GET" && path === "/offers") return await handleGetOffers(event, { getDdb, env });
      if (method === "GET" && path === "/moderation/queue") return await handleGetModerationQueue(event, { fetchJwks, getDdb, env });
      if (method === "POST" && /^\/moderation\/[^\/]+$/.test(path)) {
        const id = decodeURIComponent(path.split("/")[2]);
        return await handlePostModeration(event, { fetchJwks, getDdb, env }, id);
      }
      if (method === "POST" && /^\/needs\/[^\/]+\/status$/.test(path)) {
        const id = decodeURIComponent(path.split("/")[2]);
        return await handlePostNeedStatus(event, { fetchJwks, getDdb, env }, id);
      }
      return json(404, { error: "Not Found" });
    } catch (e) {
      const status = e.status ?? e.statusCode ?? 500;
      const safe = status === 500 ? "Internal Server Error" : e.message || "Error";
      return json(status, { error: safe });
    }
  };
}
export const handler = createHandler();
