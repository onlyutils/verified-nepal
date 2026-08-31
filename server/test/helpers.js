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
    iss: "https://accounts.google.com",
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
      this.store.set(k, input.Item);
      return {};
    }
    throw new Error(`unknown command ${name}`);
  }
}

export function makeEvent({ method = "GET", path = "/", headers = {}, rawPath } = {}) {
  return {
    rawPath: rawPath ?? path,
    headers,
    requestContext: { http: { method, path } },
  };
}
