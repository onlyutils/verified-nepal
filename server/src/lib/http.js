export function json(status, body) {
  return {
    statusCode: status,
    headers: {
      "content-type": "application/json",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
    body: JSON.stringify(body),
  };
}

export function err(status, msg) {
  const e = new Error(msg);
  e.status = status;
  return e;
}

export function getAuthToken(headers) {
  if (!headers) return null;
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === "authorization") return v;
  }
  return null;
}

export function getUpdateCodeHeader(headers) {
  if (!headers) return null;
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === "x-update-code") return String(v).trim();
  }
  return null;
}

export function getQuery(event) {
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

export function parseBody(event) {
  if (event.body === undefined || event.body === null) return null;
  if (typeof event.body === "object" && !(event.body instanceof Buffer) && !(event.body instanceof Uint8Array)) return event.body;
  const str = typeof event.body === "string" ? event.body : Buffer.from(event.body).toString("utf8");
  if (!str.trim()) return null;
  try {
    return JSON.parse(str);
  } catch (_e) {
    const e = new Error("Invalid JSON");
    e.status = 400;
    throw e;
  }
}

export function encodeCursor(key) {
  if (!key) return undefined;
  return Buffer.from(JSON.stringify(key)).toString("base64url");
}

export function decodeCursor(cur) {
  if (!cur) return null;
  try {
    const s = Buffer.from(String(cur), "base64url").toString("utf8");
    const obj = JSON.parse(s);
    if (!obj || typeof obj !== "object" || typeof obj.PK !== "string" || typeof obj.SK !== "string") throw new Error();
    return obj;
  } catch (_e) {
    throw err(400, "invalid cursor");
  }
}

export function csvEscape(val) {
  let s = String(val ?? "");
  // Neutralize spreadsheet formula injection: a cell beginning with one of these
  // is treated as a formula by Excel/Sheets. Prefixing with a single quote forces text.
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function stripInternal(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const clone = { ...obj };
  for (const k of ["updateCodeHash", "PK", "SK", "gsi1pk", "gsi1sk", "gsi2pk", "gsi2sk"]) delete clone[k];
  return clone;
}

// Route tuples are [method, regex, handler]; first match wins, capture groups become decoded handler params.
export async function dispatch(routes, method, path, event, opts) {
  for (const [m, re, handler] of routes) {
    if (m !== method) continue;
    const match = path.match(re);
    if (match) return handler(event, opts, ...match.slice(1).map(decodeURIComponent));
  }
  return null;
}
