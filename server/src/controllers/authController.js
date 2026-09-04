import { verifyIdToken } from "../verify.js";
import { json, err, getAuthToken, parseBody } from "../lib/http.js";
import { requireAuth, logAuthFail } from "../lib/auth.js";
import { getUserProfile, createUserProfile, createEmailPointer, ensureUserBackfill, saveUserProfile } from "../models/user.js";
import { validateDistrict } from "../lib/validate.js";
import { toMeView } from "../views/user.js";

function getTokenEndpoint(env) {
  const host = (env.AUTH_HOST || "https://auth.onlyutils.com").replace(/\/+$/, "");
  return `${host}/token`;
}

export async function handleMe(event, { fetchJwks, getDdb, env, fetchImpl }) {
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
  const profileRes = await getUserProfile(ddb, tableName, payload.sub);
  if (!profileRes.ok) return json(500, { error: "storage" });
  const existing = profileRes.item;
  if (existing) {
    const role = existing.role;
    const email = existing.email ?? "";
    const name = existing.name ?? "";
    const districts = Array.isArray(existing.districts) ? existing.districts : [];
    const guidelinesAckAt = existing.guidelinesAckAt;
    const emailResolved = Boolean(email);
    try { console.error({ tag: "auth_ok", claimKeys: Object.keys(payload), emailResolved }); } catch (_e) {}
    await ensureUserBackfill({ ddb, tableName, user: existing, payload });
    return json(200, toMeView({ sub: payload.sub, email, name, role, districts, guidelinesAckAt }));
  }
  const fetchFn = fetchImpl ?? globalThis.fetch;
  const host = (env.AUTH_HOST || "https://auth.onlyutils.com").replace(/\/+$/, "");
  const url = `${host}/userinfo`;
  let res;
  try {
    res = await fetchFn(url, { method: "GET", headers: { Authorization: `Bearer ${token}` } });
  } catch (e) {
    try { console.error({ tag: "userinfo_fail", status: undefined }); } catch (_e) {}
    return json(502, { error: "userinfo" });
  }
  if (!res || !res.ok) {
    try { console.error({ tag: "userinfo_fail", status: res?.status }); } catch (_e) {}
    return json(502, { error: "userinfo" });
  }
  let data;
  try {
    data = await res.json();
  } catch (e) {
    try { console.error({ tag: "userinfo_fail", status: res.status }); } catch (_e) {}
    return json(502, { error: "userinfo" });
  }
  const rawEmail = data?.email ?? data?.primary_email;
  const rawName = data?.name ?? data?.display_name;
  const email = typeof rawEmail === "string" && rawEmail.trim() ? rawEmail.trim() : undefined;
  const name = typeof rawName === "string" && rawName.trim() ? rawName.trim() : undefined;
  const emailResolved = Boolean(email);
  try { console.error({ tag: "auth_ok", claimKeys: Object.keys(payload), emailResolved }); } catch (_e) {}
  const adminEmails = (env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const moderatorEmails = (env.MODERATOR_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const emailLower = (email || "").toLowerCase();
  let role;
  if (adminEmails.includes(emailLower)) role = "admin";
  else if (moderatorEmails.includes(emailLower)) role = "moderator";
  else role = "helper";
  const nowIso = new Date().toISOString();
  const item = { PK: `USER#${payload.sub}`, SK: "PROFILE", type: "USER", sub: payload.sub, role, districts: [], createdAt: nowIso, gsi2pk: `USER#${role}`, gsi2sk: nowIso };
  if (email !== undefined) item.email = email;
  if (name !== undefined) item.name = name;
  const createRes = await createUserProfile(ddb, tableName, item);
  if (!createRes.ok) return json(500, { error: "storage" });
  if (email) await createEmailPointer(ddb, tableName, { sub: payload.sub, email, createdAt: nowIso });
  return json(200, toMeView({ sub: payload.sub, email: email ?? "", name: name ?? "", role, districts: [], guidelinesAckAt: undefined }));
}

export async function handleAckGuidelines(event, opts) {
  const auth = await requireAuth(event, opts);
  const tableName = auth.tableName;
  const ddb = auth.ddb;
  const pk = `USER#${auth.payload.sub}`;
  const sk = "PROFILE";
  let user = auth.user;
  // Do not create a bare helper profile here: that would pre-empt the email-based
  // admin/moderator bootstrap that GET /me performs on first sign-in (a lockout).
  if (!user) throw err(409, "profile not initialized; call GET /me first");
  const nowIso = new Date().toISOString();
  user.guidelinesAckAt = nowIso;
  if (!Array.isArray(user.districts)) user.districts = [];
  if (!user.gsi2pk) user.gsi2pk = `USER#${user.role}`;
  if (!user.gsi2sk) user.gsi2sk = user.createdAt || nowIso;
  await saveUserProfile(ddb, tableName, user);
  return json(200, { guidelinesAckAt: nowIso });
}

export async function handleSetMyDistricts(event, opts) {
  const auth = await requireAuth(event, opts);
  if (auth.role !== "moderator") throw err(403, "moderators_only");
  const body = parseBody(event);
  if (!body || !Array.isArray(body.districts)) throw err(400, "districts must be array");
  if (body.districts.length < 1 || body.districts.length > 10) throw err(400, "districts must be 1-10 items");
  const districts = body.districts.map((d) => validateDistrict(d, "districts[]"));
  const user = auth.user;
  user.districts = districts;
  if (!user.gsi2pk) user.gsi2pk = `USER#${user.role}`;
  if (!user.gsi2sk) user.gsi2sk = user.createdAt || new Date().toISOString();
  await saveUserProfile(auth.ddb, auth.tableName, user);
  return json(200, { districts });
}

export async function handleAuthExchange(event, { env, fetchImpl }) {
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
  } catch (_e) {
    throw err(400, "token exchange failed");
  }
  let data;
  try {
    data = await res.json();
  } catch (_e) {
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

export async function handleAuthRefresh(event, { env, fetchImpl }) {
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
  } catch (_e) {
    throw err(400, "token refresh failed");
  }
  let data;
  try {
    data = await res.json();
  } catch (_e) {
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
