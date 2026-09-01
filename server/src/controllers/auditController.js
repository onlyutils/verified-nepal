import { err, getQuery, decodeCursor, encodeCursor } from "../lib/http.js";
import { listAuditByMonth } from "../models/audit.js";
import { toPublicAuditLine } from "../views/audit.js";

export async function handleGetAudit(event, { getDdb, env }) {
  const q = getQuery(event);
  const monthRaw = q.month ? String(q.month).trim() : "";
  const cursorRaw = q.cursor ? String(q.cursor).trim() : "";
  if (!monthRaw || !/^\d{4}-\d{2}$/.test(monthRaw)) throw err(400, "month must be YYYY-MM");
  const cursorKey = decodeCursor(cursorRaw);
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  const res = await listAuditByMonth(ddb, tableName, monthRaw, cursorKey);
  const rawItems = res.Items || [];
  const items = rawItems.map(toPublicAuditLine);
  const body = { items };
  if (res.LastEvaluatedKey) body.cursor = encodeCursor(res.LastEvaluatedKey);
  return { statusCode: 200, headers: { "content-type": "application/json", "cache-control": "public, max-age=60" }, body: JSON.stringify(body) };
}
