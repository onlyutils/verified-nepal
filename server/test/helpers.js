import { generateKeyPairSync, createSign } from "node:crypto";

export const TEST_INCIDENT_ID = "test-incident";

export function seedActiveIncident(ddb, overrides = {}) {
  const id = overrides.id ?? TEST_INCIDENT_ID;
  const status = overrides.status ?? "active";
  const createdAt = overrides.createdAt ?? "2026-01-01T00:00:00.000Z";
  const item = {
    name: "Test Incident",
    kind: "flash-flood",
    startedAt: "2026-01-01",
    affectedDistricts: ["Gorkha", "Rasuwa", "Nuwakot", "Sindhupalchok", "Kaski", "Kathmandu"],
    summary: "Incident used by backend tests",
    requestOrigin: "admin",
    createdBy: "test-admin",
    createdAt,
    ...overrides,
  };
  item.PK = `INCIDENT#${id}`;
  item.SK = "META";
  item.type = "INCIDENT";
  item.id = id;
  item.status = status;
  item.createdAt = createdAt;
  item.gsi1pk = overrides.gsi1pk ?? `INCIDENT#${status}`;
  item.gsi1sk = overrides.gsi1sk ?? createdAt;
  ddb.store.set(`${item.PK}|${item.SK}`, item);
  return item;
}

export function makeKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicExponent: 0x10001,
  });
  const jwk = publicKey.export({ format: "jwk" });
  jwk.kid = "test-kid";
  jwk.alg = "RS256";
  jwk.use = "sig";
  return { privateKey, publicKey, jwk };
}

export function createToken(payload, privateKey, kid = "test-kid") {
  const header = { alg: "RS256", kid, typ: "JWT" };
  const hB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
  const pB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(`${hB64}.${pB64}`);
  signer.end();
  const sig = signer.sign(privateKey).toString("base64url");
  return `${hB64}.${pB64}.${sig}`;
}

export function basePayload(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: "https://auth.onlyutils.com",
    aud: "test-client-id",
    sub: "1234567890",
    email: "user@example.com",
    name: "Test User",
    exp: now + 3600,
    iat: now,
    ...overrides,
  };
}

function splitTopLevel(s, sep) {
  const parts = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === sep && depth === 0) { parts.push(cur); cur = ""; }
    else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((x) => x.trim());
}

function resolvePath(pathStr, names) {
  return pathStr.split(".").map((seg) => (seg.startsWith("#") ? names[seg] : seg));
}

function getAtPath(obj, segs) {
  let cur = obj;
  for (const s of segs) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = cur[s];
  }
  return cur;
}

function setAtPath(obj, segs, value) {
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    if (typeof cur[segs[i]] !== "object" || cur[segs[i]] === null) cur[segs[i]] = {};
    cur = cur[segs[i]];
  }
  cur[segs[segs.length - 1]] = value;
}

function removeAtPath(obj, segs) {
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    if (cur[segs[i]] === null || typeof cur[segs[i]] !== "object") return;
    cur = cur[segs[i]];
  }
  delete cur[segs[segs.length - 1]];
}

function evalPredicate(p, item, names, vals) {
  let m = p.match(/^attribute_not_exists\((.+)\)$/);
  if (m) return getAtPath(item, resolvePath(m[1].trim(), names)) === undefined;
  m = p.match(/^attribute_exists\((.+)\)$/);
  if (m) return getAtPath(item, resolvePath(m[1].trim(), names)) !== undefined;
  m = p.match(/^(.+?)\s*=\s*(:\w+)$/);
  if (m) return JSON.stringify(getAtPath(item, resolvePath(m[1].trim(), names))) === JSON.stringify(vals[m[2]]);
  throw new Error(`FakeDdb: unsupported condition predicate "${p}"`);
}

function evalCondition(expr, item, names, vals) {
  if (!expr) return true;
  const trimmed = expr.trim();
  const hasOr = / OR /.test(trimmed);
  const hasAnd = / AND /.test(trimmed);
  if (hasOr && hasAnd) throw new Error("FakeDdb: mixed AND/OR conditions are not supported, keep expressions homogeneous");
  const parts = hasOr ? trimmed.split(" OR ") : hasAnd ? trimmed.split(" AND ") : [trimmed];
  const results = parts.map((p) => evalPredicate(p.trim(), item, names, vals));
  return hasOr ? results.some(Boolean) : results.every(Boolean);
}

export class FakeDdb {
  constructor() {
    this.store = new Map();
  }
  key(pk, sk) { return `${pk}|${sk}`; }
  async send(cmd) {
    const name = cmd.constructor.name;
    const input = cmd.input;
    if (name === "GetCommand") {
      const k = this.key(input.Key.PK, input.Key.SK);
      return { Item: this.store.get(k) };
    }
    if (name === "PutCommand") {
      const k = this.key(input.Item.PK, input.Item.SK);
      if (input.ConditionExpression && this.store.has(k)) {
        const e = new Error("ConditionalCheckFailed");
        e.name = "ConditionalCheckFailedException";
        throw e;
      }
      this.store.set(k, JSON.parse(JSON.stringify(input.Item)));
      return {};
    }
    if (name === "ScanCommand") {
      const items = Array.from(this.store.values());
      let start = 0;
      if (input.ExclusiveStartKey) {
        const ek = this.key(input.ExclusiveStartKey.PK, input.ExclusiveStartKey.SK);
        const idx = items.findIndex((it) => this.key(it.PK, it.SK) === ek);
        if (idx >= 0) start = idx + 1;
      }
      let sliced = items.slice(start);
      if (input.Limit) sliced = sliced.slice(0, input.Limit);
      const result = { Items: sliced, Count: sliced.length };
      if (start + sliced.length < items.length) {
        const last = sliced[sliced.length - 1];
        result.LastEvaluatedKey = { PK: last.PK, SK: last.SK };
      }
      return result;
    }
    if (name === "QueryCommand") {
      let items = Array.from(this.store.values());
      const vals = input.ExpressionAttributeValues || {};
      let pkVal = null;
      if (vals[":pk"] !== undefined) pkVal = vals[":pk"];
      else if (vals[":gsi1pk"] !== undefined) pkVal = vals[":gsi1pk"];
      else if (vals[":gsi2pk"] !== undefined) pkVal = vals[":gsi2pk"];
      else {
        const firstKey = Object.keys(vals)[0];
        if (firstKey) pkVal = vals[firstKey];
      }
      const expr = input.KeyConditionExpression || "";
      const hasBegins = expr.includes("begins_with");
      const hasPkCond = expr.includes("PK =") || expr.includes("PK=") || vals[":pk"] !== undefined;
      if (pkVal) {
        if (input.IndexName === "GSI1") {
          items = items.filter((it) => it.gsi1pk === pkVal);
          items.sort((a, b) => (a.gsi1sk || "").localeCompare(b.gsi1sk || ""));
        } else if (input.IndexName === "GSI2") {
          items = items.filter((it) => it.gsi2pk === pkVal);
          items.sort((a, b) => (a.gsi2sk || "").localeCompare(b.gsi2sk || ""));
        } else if (!input.IndexName) {
          if (hasBegins && vals[":prefix"] !== undefined) {
            const prefix = vals[":prefix"];
            items = items.filter((it) => it.PK === pkVal && typeof it.SK === "string" && it.SK.startsWith(prefix));
          } else if (hasBegins && vals[":skPrefix"] !== undefined) {
            const prefix = vals[":skPrefix"];
            items = items.filter((it) => it.PK === pkVal && typeof it.SK === "string" && it.SK.startsWith(prefix));
          } else {
            items = items.filter((it) => it.PK === pkVal);
          }
          items.sort((a, b) => (a.SK || "").localeCompare(b.SK || ""));
        } else {
          items = items.filter((it) => it.gsi1pk === pkVal || it.gsi2pk === pkVal);
          items.sort((a, b) => (a.gsi1sk || a.gsi2sk || "").localeCompare(b.gsi1sk || b.gsi2sk || ""));
        }
        if (input.ScanIndexForward === false) items.reverse();
      } else {
        if (input.IndexName === undefined && hasPkCond) {
          // no pkVal resolved but expression references PK - treat as empty
          items = [];
        }
        items.sort((a, b) => (a.gsi1sk || a.gsi2sk || "").localeCompare(b.gsi1sk || b.gsi2sk || ""));
        if (input.ScanIndexForward === false) items.reverse();
      }
      let start = 0;
      if (input.ExclusiveStartKey) {
        const ek = this.key(input.ExclusiveStartKey.PK, input.ExclusiveStartKey.SK);
        const idx = items.findIndex((it) => this.key(it.PK, it.SK) === ek);
        if (idx >= 0) start = idx + 1;
      }
      let sliced = items.slice(start);
      if (input.Limit) sliced = sliced.slice(0, input.Limit);
      const result = { Items: sliced, Count: sliced.length };
      if (start + sliced.length < items.length) {
        const last = sliced[sliced.length - 1];
        result.LastEvaluatedKey = { PK: last.PK, SK: last.SK };
      }
      return result;
    }
    if (name === "DeleteCommand") {
      const k = this.key(input.Key.PK, input.Key.SK);
      if (input.ConditionExpression && input.ConditionExpression.includes("attribute_exists") && !this.store.has(k)) {
        const e = new Error("ConditionalCheckFailed");
        e.name = "ConditionalCheckFailedException";
        throw e;
      }
      this.store.delete(k);
      return {};
    }
    if (name === "UpdateCommand") {
      const k = this.key(input.Key.PK, input.Key.SK);
      const stored = this.store.get(k);
      const item = stored ? JSON.parse(JSON.stringify(stored)) : { PK: input.Key.PK, SK: input.Key.SK };
      const names = input.ExpressionAttributeNames || {};
      const vals = input.ExpressionAttributeValues || {};
      if (input.ConditionExpression && !evalCondition(input.ConditionExpression, item, names, vals)) {
        const e = new Error("ConditionalCheckFailed");
        e.name = "ConditionalCheckFailedException";
        throw e;
      }
      const expr = input.UpdateExpression || "";
      const removeMatch = expr.match(/REMOVE\s+(.+?)(?:\s+SET\s+|\s+ADD\s+|$)/is);
      const setMatch = expr.match(/SET\s+(.+?)(?:\s+REMOVE\s+|\s+ADD\s+|$)/is);
      const addMatch = expr.match(/ADD\s+(.+?)(?:\s+SET\s+|\s+REMOVE\s+|$)/is);
      if (removeMatch) {
        for (const p of splitTopLevel(removeMatch[1], ",")) removeAtPath(item, resolvePath(p, names));
      }
      if (addMatch) {
        for (const part of splitTopLevel(addMatch[1], ",")) {
          const [a, v] = part.trim().split(/\s+/);
          const segs = resolvePath(a, names);
          setAtPath(item, segs, (getAtPath(item, segs) || 0) + vals[v]);
        }
      }
      if (setMatch) {
        for (const part of splitTopLevel(setMatch[1], ",")) {
          const eq = part.indexOf("=");
          const lhs = part.slice(0, eq).trim();
          const rhs = part.slice(eq + 1).trim();
          const segs = resolvePath(lhs, names);
          const ifm = rhs.match(/^if_not_exists\((.+),\s*(:\w+)\)$/);
          let value;
          if (ifm) {
            const existing = getAtPath(item, resolvePath(ifm[1].trim(), names));
            value = existing !== undefined ? existing : vals[ifm[2]];
          } else {
            value = vals[rhs];
          }
          setAtPath(item, segs, value);
        }
      }
      this.store.set(k, item);
      if (input.ReturnValues === "ALL_NEW" || input.ReturnValues === "UPDATED_NEW") return { Attributes: JSON.parse(JSON.stringify(item)) };
      return {};
    }
    throw new Error(`unknown command ${name}`);
  }
}

export function makeEvent({ method = "GET", path = "/", headers = {}, rawPath, body, queryStringParameters } = {}) {
  const event = {
    rawPath: rawPath ?? path,
    headers,
    requestContext: { http: { method, path: (rawPath ?? path).split("?")[0] } },
  };
  if (body !== undefined) event.body = typeof body === "string" ? body : JSON.stringify(body);
  if (queryStringParameters) event.queryStringParameters = queryStringParameters;
  return event;
}
