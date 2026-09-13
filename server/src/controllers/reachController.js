import { json, err, parseBody } from "../lib/http.js";
import { getReachAdminStats, recordPageView } from "../models/reach.js";

const REFERRER_RE = /^[a-z0-9.-]+$/i;

function requireTable(env) {
  if (!env.TABLE_NAME) throw err(500, "TABLE_NAME not configured");
  return env.TABLE_NAME;
}

export async function handlePostReach(event, { getDdb, env }) {
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  if (typeof body.page !== "string" || !/^[a-zA-Z]{1,32}$/.test(body.page)) throw err(400, "invalid page");
  if (typeof body.path !== "string" || !body.path.startsWith("/") || body.path.length > 200) throw err(400, "invalid path");
  const lang = body.lang === "ne" ? "ne" : "en";
  const ref = typeof body.ref === "string" && body.ref.length <= 100 && REFERRER_RE.test(body.ref) ? body.ref : undefined;
  await recordPageView(getDdb(), requireTable(env), {
    page: body.page,
    path: body.path,
    lang,
    ref,
    newSession: Boolean(body.newSession),
  });
  return { statusCode: 204, headers: {}, body: "" };
}

export async function handleGetAdminReach(event, opts) {
  const { auth } = opts;
  if (auth.role !== "admin") throw err(403, "Forbidden");
  const stats = await getReachAdminStats(auth.ddb, auth.tableName);
  return json(200, stats);
}
