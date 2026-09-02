import { generateKeyPairSync, createSign } from "node:crypto";

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
      this.store.delete(k);
      return {};
    }
    if (name === "UpdateCommand") {
      const k = this.key(input.Key.PK, input.Key.SK);
      const item = this.store.get(k) ? JSON.parse(JSON.stringify(this.store.get(k))) : { PK: input.Key.PK, SK: input.Key.SK };
      const expr = input.UpdateExpression || "";
      const vals = input.ExpressionAttributeValues || {};
      const names = input.ExpressionAttributeNames || {};
      const resolve = (t) => (t.startsWith("#") ? names[t] : t);
      const addM = expr.match(/ADD\s+(.+?)(?:\s+SET\s+|$)/i);
      const setM = expr.match(/SET\s+(.+?)(?:\s+ADD\s+|$)/i);
      if (addM) for (const part of addM[1].split(",")) { const [a, v] = part.trim().split(/\s+/); const nm = resolve(a); item[nm] = (item[nm] || 0) + (vals[v] || 0); }
      if (setM) for (const part of setM[1].split(",")) { const [lhs, rhs] = part.split("=").map((x) => x.trim()); item[resolve(lhs)] = vals[rhs]; }
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
