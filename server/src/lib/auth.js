import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { verifyIdToken } from "../verify.js";
import { err, getAuthToken, getUpdateCodeHeader } from "./http.js";
import { hashUpdateCode } from "./format.js";

export function ensureGuidelinesAck(auth) {
  if (auth.role === "moderator" && !auth.user?.guidelinesAckAt) {
    throw err(403, "guidelines_not_acknowledged");
  }
}

export function getItemDistrict(item) {
  if (!item) return "";
  if (item.PK && item.PK.startsWith("NEED#")) return item.beneficiary?.district || item.district || "";
  if (item.PK && item.PK.startsWith("OFFER#")) return Array.isArray(item.districts) ? item.districts : [];
  if (item.PK && item.PK.startsWith("PROJECT#")) return item.district || "";
  if (item.type === "NEED") return item.beneficiary?.district || item.district || "";
  if (item.type === "OFFER") return Array.isArray(item.districts) ? item.districts : [];
  if (item.type === "PROJECT") return item.district || "";
  return "";
}

export function isOutOfScope(user, itemOrDistrict) {
  if (!user) return false;
  if (user.role === "admin") return false;
  const scope = Array.isArray(user.districts) ? user.districts : [];
  if (scope.length === 0) return false;
  let districts = [];
  if (typeof itemOrDistrict === "string") districts = [itemOrDistrict];
  else if (Array.isArray(itemOrDistrict)) districts = itemOrDistrict;
  else if (itemOrDistrict && typeof itemOrDistrict === "object") {
    const d = getItemDistrict(itemOrDistrict);
    if (Array.isArray(d)) districts = d;
    else if (typeof d === "string" && d) districts = [d];
    else districts = [];
  }
  if (districts.length === 0) return true;
  return !districts.some((d) => scope.includes(d));
}

export function logAuthFail(token, err) {
  let iss;
  let aud;
  let alg;
  try {
    const parts = String(token).split(".");
    if (parts.length >= 1) {
      try {
        const headerJson = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
        if (headerJson && typeof headerJson.alg === "string") alg = headerJson.alg;
      } catch (_e) {}
    }
    if (parts.length >= 2) {
      try {
        const payloadJson = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
        if (payloadJson && typeof payloadJson.iss === "string") iss = payloadJson.iss;
        if (payloadJson && payloadJson.aud !== undefined) aud = payloadJson.aud;
      } catch (_e) {}
    }
  } catch (_e) {}
  try {
    console.error(JSON.stringify({ tag: "auth_fail", reason: err.message, iss, aud, alg }));
  } catch (_e) {}
}

export async function requireAuth(event, { fetchJwks, getDdb, env }) {
  const auth = getAuthToken(event.headers);
  if (!auth || !auth.startsWith("Bearer ")) throw err(401, "Missing or invalid Authorization header");
  const token = auth.slice("Bearer ".length).trim();
  if (!token) throw err(401, "Missing token");
  let payload;
  try {
    payload = await verifyIdToken(token, { fetchJwks, env });
  } catch (e) {
    if (e.status === 500) throw e;
    try { logAuthFail(token, e); } catch (_e) {}
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
  } catch (_e) {
    throw err(500, "Failed to read user");
  }
  let role = user?.role;
  if (!user) {
    role = "helper";
  }
  return { payload, user, role, ddb, tableName };
}

/** Like requireAuth, but a request without an Authorization header is allowed through as null. */
export async function optionalAuth(event, opts) {
  const header = getAuthToken(event.headers);
  if (!header) return null;
  return requireAuth(event, opts);
}

export async function requireModAuth(event, opts) {
  const auth = await requireAuth(event, opts);
  if (!["moderator", "admin"].includes(auth.role)) throw err(403, "Forbidden");
  return auth;
}

export async function verifyCommitteeAuth(headers, projectId, getDdb, env) {
  const code = getUpdateCodeHeader(headers);
  if (!code) return null;
  const hash = hashUpdateCode(code);
  const ddb = getDdb();
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  let pointer;
  try { pointer = (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `PCODE#${hash}`, SK: "META" } }))).Item; } catch (_e) { return null; }
  if (!pointer || pointer.projectId !== projectId) return null;
  let proj;
  try { proj = (await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `PROJECT#${projectId}`, SK: "META" } }))).Item; } catch (_e) { return null; }
  if (!proj || proj.updateCodeHash !== hash) return null;
  return { code, hash, isCommittee: true };
}

export async function authorizeProjectWrite(event, opts, projectId) {
  const committee = await verifyCommitteeAuth(event.headers, projectId, opts.getDdb, opts.env);
  if (committee) return { isCommittee: true, isMod: false, role: "committee" };
  try {
    const auth = await requireAuth(event, opts);
    if (["moderator", "admin"].includes(auth.role)) return { isCommittee: false, isMod: true, role: auth.role, auth };
    throw err(403, "Forbidden");
  } catch (e) {
    if (e.status === 401) throw e;
    if (committee) return { isCommittee: true, isMod: false, role: "committee" };
    throw e;
  }
}
