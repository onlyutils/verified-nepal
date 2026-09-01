import { randomUUID } from "node:crypto";

let mediaTokenCache = { token: null, expiresAt: 0 };

export function __clearMediaTokenCache() {
  mediaTokenCache = { token: null, expiresAt: 0 };
}

export async function getMachineToken(env, fetchImpl) {
  if (mediaTokenCache.token && Date.now() < mediaTokenCache.expiresAt - 60000) return mediaTokenCache.token;
  const clientId = env.OU_MEDIA_CLIENT_ID;
  const clientSecret = env.OU_MEDIA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const e = new Error("media not configured");
    e.status = 503;
    e.code = "media_not_configured";
    throw e;
  }
  const fetchFn = fetchImpl ?? globalThis.fetch;
  let res;
  try {
    res = await fetchFn("https://auth.onlyutils.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }).toString(),
    });
  } catch (_e) {
    const e = new Error("media token fetch failed");
    e.status = 502;
    e.code = "media_upstream";
    throw e;
  }
  if (!res.ok) {
    let msg = "media token failed";
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
    const e = new Error(msg);
    e.status = 502;
    e.code = "media_upstream";
    throw e;
  }
  let data;
  try { data = await res.json(); } catch { const e = new Error("media token invalid json"); e.status = 502; e.code = "media_upstream"; throw e; }
  const token = data.access_token || data.accessToken;
  if (!token) { const e = new Error("media token missing"); e.status = 502; e.code = "media_upstream"; throw e; }
  const expiresIn = data.expires_in ? Number(data.expires_in) : data.expiresIn ? Number(data.expiresIn) : 900;
  mediaTokenCache.token = token;
  mediaTokenCache.expiresAt = Date.now() + expiresIn * 1000;
  return token;
}

export async function requestPresign(env, fetchImpl, { filename, contentType }) {
  const clientId = env.OU_MEDIA_CLIENT_ID;
  const mediaHost = (env.MEDIA_HOST || "https://media.onlyutils.com").replace(/\/+$/, "");
  const token = await getMachineToken(env, fetchImpl);
  const fetchFn = fetchImpl ?? globalThis.fetch;
  const idem = randomUUID();
  let res;
  try {
    res = await fetchFn(`${mediaHost}/v1/clients/${clientId}/media/files`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": idem },
      body: JSON.stringify({ filename, content_type: contentType, visibility: "public" }),
    });
  } catch (_e) {
    const e = new Error("media presign failed");
    e.status = 502;
    e.code = "media_upstream";
    throw e;
  }
  if (!res.ok) {
    let msg = "media presign failed";
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
    const e = new Error(msg);
    e.status = 502;
    e.code = "media_upstream";
    throw e;
  }
  let data;
  try { data = await res.json(); } catch {
    const e = new Error("media presign invalid json");
    e.status = 502;
    e.code = "media_upstream";
    throw e;
  }
  const payload = data.data ?? data;
  const fileId = payload.file_id ?? payload.fileId ?? payload.id;
  const uploadUrl = payload.upload?.url ?? payload.upload_url ?? payload.uploadUrl ?? payload.url;
  let publicUrl = payload.public_url ?? payload.publicUrl ?? payload.url;
  const headers = payload.upload?.headers ?? payload.headers ?? payload.upload_headers ?? undefined;
  if (!fileId || !uploadUrl) {
    const e = new Error("media presign malformed");
    e.status = 502;
    e.code = "media_upstream";
    throw e;
  }
  const base = env.MEDIA_PUBLIC_BASE ? String(env.MEDIA_PUBLIC_BASE).replace(/\/+$/, "") : null;
  if (base) publicUrl = `${base}/${payload.key ?? fileId}`;
  if (!publicUrl) publicUrl = uploadUrl;
  const out = { uploadUrl, fileId, publicUrl };
  if (headers) out.headers = headers;
  return out;
}
