import { createPublicKey, verify } from "node:crypto";

const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const CACHE_TTL_MS = 60 * 60 * 1000;

let cachedJwks = null;
let cachedAt = 0;

async function defaultFetchJwks() {
  const res = await fetch(JWKS_URL);
  if (!res.ok) {
    const e = new Error("failed to fetch jwks");
    e.status = 500;
    throw e;
  }
  return res.json();
}

function b64urlDecode(str) {
  const buf = Buffer.from(str, "base64url");
  return buf;
}

function jsonResponse(status, body) {
  return {
    statusCode: status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function clearJwksCache() {
  cachedJwks = null;
  cachedAt = 0;
}

export async function verifyIdToken(token, opts = {}) {
  const fetchJwks = opts.fetchJwks ?? defaultFetchJwks;
  const googleClientId = opts.googleClientId ?? process.env.GOOGLE_CLIENT_ID;

  if (!googleClientId) {
    const e = new Error("GOOGLE_CLIENT_ID not configured");
    e.status = 500;
    throw e;
  }
  if (!token || typeof token !== "string") {
    const e = new Error("missing token");
    e.status = 401;
    throw e;
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    const e = new Error("invalid token format");
    e.status = 401;
    throw e;
  }
  const [hB64, pB64, sB64] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(b64urlDecode(hB64).toString("utf8"));
    payload = JSON.parse(b64urlDecode(pB64).toString("utf8"));
  } catch {
    const e = new Error("invalid token encoding");
    e.status = 401;
    throw e;
  }

  if (header.alg !== "RS256") {
    const e = new Error("unsupported alg");
    e.status = 401;
    throw e;
  }
  const kid = header.kid;

  async function getJwks() {
    const now = Date.now();
    if (cachedJwks && now - cachedAt < CACHE_TTL_MS) return cachedJwks;
    const jwks = await fetchJwks();
    if (!jwks || !Array.isArray(jwks.keys)) {
      const e = new Error("invalid jwks");
      e.status = 500;
      throw e;
    }
    cachedJwks = jwks;
    cachedAt = now;
    return jwks;
  }

  let jwks = await getJwks();
  let jwk = jwks.keys.find((k) => k.kid === kid);
  if (!jwk) {
    cachedJwks = null;
    jwks = await getJwks();
    jwk = jwks.keys.find((k) => k.kid === kid);
    if (!jwk) {
      const e = new Error("unknown kid");
      e.status = 401;
      throw e;
    }
  }

  let publicKey;
  try {
    publicKey = createPublicKey({ key: jwk, format: "jwk" });
  } catch {
    const e = new Error("invalid jwk");
    e.status = 401;
    throw e;
  }

  const data = Buffer.from(`${hB64}.${pB64}`);
  const sig = b64urlDecode(sB64);
  let ok = false;
  try {
    ok = verify("RSA-SHA256", data, publicKey, sig);
  } catch {
    ok = false;
  }
  if (!ok) {
    const e = new Error("invalid signature");
    e.status = 401;
    throw e;
  }

  const issOk =
    payload.iss === "https://accounts.google.com" ||
    payload.iss === "accounts.google.com";
  if (!issOk) {
    const e = new Error("invalid iss");
    e.status = 401;
    throw e;
  }
  if (payload.aud !== googleClientId) {
    const e = new Error("invalid aud");
    e.status = 401;
    throw e;
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= nowSec) {
    const e = new Error("token expired");
    e.status = 401;
    throw e;
  }
  if (!payload.sub || typeof payload.sub !== "string") {
    const e = new Error("missing sub");
    e.status = 401;
    throw e;
  }

  return payload;
}
