import { json, err, getQuery, parseBody } from "../lib/http.js";
import { verifyTurnstile } from "../lib/turnstile.js";
import { CLIMATE_DOWNLOAD_KINDS, CLIMATE_MESSAGE_IDS } from "../constants.js";
import { getClimateAdminStats, listMessageCounts, recordDownload, recordMessage } from "../models/climate.js";

function requireTable(env) {
  if (!env.TABLE_NAME) throw err(500, "TABLE_NAME not configured");
  return env.TABLE_NAME;
}

export async function handlePostClimateMessage(event, { getDdb, env }) {
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { iso3, messageId, turnstileToken } = body;
  if (typeof iso3 !== "string" || !/^[A-Z]{3}$/.test(iso3) || iso3 === "NPL") throw err(400, "invalid iso3");
  if (typeof messageId !== "string" || !CLIMATE_MESSAGE_IDS.includes(messageId)) throw err(400, "invalid messageId");
  await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET, { required: env.REQUIRE_TURNSTILE === "1" });
  const count = await recordMessage(getDdb(), requireTable(env), { iso3, messageId });
  return json(201, { ok: true, count });
}

export async function handleGetClimateMessages(event, { getDdb, env }) {
  const q = getQuery(event);
  const country = q.country === undefined || q.country === null ? "" : String(q.country).trim();
  if (country && !/^[A-Z]{3}$/.test(country)) throw err(400, "invalid country");
  const items = await listMessageCounts(getDdb(), requireTable(env), country || undefined);
  const response = json(200, { items, total: items.reduce((sum, item) => sum + item.count, 0) });
  response.headers["cache-control"] = "public, max-age=60";
  return response;
}

export async function handlePostClimateDownload(event, { getDdb, env }) {
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  if (typeof body.kind !== "string" || !CLIMATE_DOWNLOAD_KINDS.includes(body.kind)) throw err(400, "invalid kind");
  await recordDownload(getDdb(), requireTable(env), body.kind);
  return json(202, { ok: true });
}

export async function handleGetAdminClimate(event, opts) {
  const { auth } = opts;
  if (auth.role !== "admin") throw err(403, "Forbidden");
  const stats = await getClimateAdminStats(auth.ddb, auth.tableName);
  return json(200, stats);
}
