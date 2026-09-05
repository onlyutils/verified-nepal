import { json, err, getQuery, parseBody } from "../lib/http.js";
import { verifyTurnstile } from "../lib/turnstile.js";
import { CLIMATE_DOWNLOAD_KINDS, CLIMATE_MESSAGE_IDS } from "../constants.js";
import { getClimateAdminStats, listMessageCounts, recordDownload, recordMessage } from "../models/climate.js";

function requireTable(env) {
  if (!env.TABLE_NAME) throw err(500, "TABLE_NAME not configured");
  return env.TABLE_NAME;
}

const MAX_MESSAGES_PER_SUBMIT = 3;

export async function handlePostClimateMessage(event, { getDdb, env }) {
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { iso3, messageId, messageIds, turnstileToken } = body;
  const ids = Array.isArray(messageIds) ? messageIds : typeof messageId === "string" ? [messageId] : null;
  if (typeof iso3 !== "string" || !/^[A-Z]{3}$/.test(iso3) || iso3 === "NPL") throw err(400, "invalid iso3");
  if (
    !ids ||
    !ids.length ||
    ids.length > MAX_MESSAGES_PER_SUBMIT ||
    !ids.every((id) => typeof id === "string" && CLIMATE_MESSAGE_IDS.includes(id))
  )
    throw err(400, "invalid messageId");
  // One human check covers the whole batch: a Turnstile token is single-use, so verifying it
  // once per selected message would fail every submission after the first.
  await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET, { required: env.REQUIRE_TURNSTILE === "1" });
  const counts = {};
  for (const id of ids) counts[id] = await recordMessage(getDdb(), requireTable(env), { iso3, messageId: id });
  return json(201, { ok: true, count: counts[ids[0]], counts });
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
