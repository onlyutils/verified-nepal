import { json, err, getQuery, parseBody } from "../lib/http.js";
import { isOutOfScope } from "../lib/auth.js";
import { performRedeem, queryLedger } from "../models/claim.js";
import { listNeedsByDistrictStatuses } from "../models/need.js";
import { toClaimPrintItem } from "../views/need.js";
import { toLedgerItem, toLedgerCsv } from "../views/ledger.js";

export async function handleRedeem(event, opts, code) {
  const { auth } = opts;
  const body = parseBody(event) || {};
  let note;
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== "string") throw err(400, "note must be string");
    const t = body.note.trim();
    if (t.length > 500) throw err(400, "note too long");
    if (t) note = t;
  }
  if (!code || typeof code !== "string" || !code.trim()) throw err(400, "code required");
  const claimCode = code.trim().toUpperCase();
  const result = await performRedeem(auth.ddb, auth.tableName, {
    claimCode, providedRedeemedAt: undefined, note, user: auth.user,
    actorSub: auth.payload.sub, actorName: auth.user?.name || auth.payload.name || "",
  });
  if (result.status === "unknown") throw err(404, "unknown claim code");
  if (result.status === "already_redeemed") {
    return json(409, { error: "already_redeemed", redeemedAt: result.redeemedAt });
  }
  return json(200, { status: "redeemed", needId: result.needId, redeemedAt: result.redeemedAt });
}

export async function handleSync(event, opts) {
  const { auth } = opts;
  const body = parseBody(event);
  if (!body || typeof body !== "object" || !Array.isArray(body.redemptions)) throw err(400, "redemptions must be array");
  const redemptions = body.redemptions;
  if (redemptions.length > 200) throw err(400, "max 200 redemptions");
  const results = [];
  const actorName = auth.user?.name || auth.payload.name || "";
  for (const r of redemptions) {
    if (!r || typeof r !== "object" || typeof r.code !== "string" || !r.code.trim()) {
      results.push({ code: r?.code ?? "", status: "unknown" });
      continue;
    }
    const code = r.code.trim().toUpperCase();
    if (!r.redeemedAt || typeof r.redeemedAt !== "string") {
      throw err(400, "redeemedAt required and must be ISO string");
    }
    const d = new Date(r.redeemedAt);
    if (Number.isNaN(d.getTime())) throw err(400, "redeemedAt must be valid ISO datetime");
    const iso = d.toISOString();
    let note;
    if (r.note !== undefined && r.note !== null) {
      if (typeof r.note !== "string") throw err(400, "note must be string");
      const t = r.note.trim();
      if (t.length > 500) throw err(400, "note too long");
      if (t) note = t;
    }
    const res = await performRedeem(auth.ddb, auth.tableName, {
      claimCode: code, providedRedeemedAt: iso, note, user: auth.user,
      actorSub: auth.payload.sub, actorName,
    });
    if (res.status === "unknown") results.push({ code, status: "unknown" });
    else if (res.status === "already_redeemed") results.push({ code, status: "already_redeemed", needId: res.needId });
    else results.push({ code, status: "redeemed", needId: res.needId });
  }
  return json(200, { results });
}

export async function handlePrint(event, opts) {
  const { auth } = opts;
  const q = getQuery(event);
  const district = q.district ? String(q.district).trim() : "";
  const wardRaw = q.ward ? String(q.ward).trim() : "";
  if (!district) throw err(400, "district required");
  if (!wardRaw) throw err(400, "ward required");
  const ward = Number(wardRaw);
  if (!Number.isInteger(ward) || ward < 1 || ward > 33) throw err(400, "ward must be integer 1-33");
  if (isOutOfScope(auth.user, district)) throw err(403, "out_of_scope");
  let items = await listNeedsByDistrictStatuses(auth.ddb, auth.tableName, district, ["published", "matched"]);
  items = items.filter((it) => (it.beneficiary?.ward ?? it.ward) === ward);
  const mapped = items.map(toClaimPrintItem);
  mapped.sort((a, b) => a.maskedName.localeCompare(b.maskedName));
  return json(200, { items: mapped });
}

export async function handleLedger(event, { getDdb, env }) {
  const q = getQuery(event);
  const district = q.district ? String(q.district).trim() : "";
  const wardRaw = q.ward ? String(q.ward).trim() : "";
  const format = q.format ? String(q.format).trim().toLowerCase() : "json";
  if (format !== "json" && format !== "csv") throw err(400, "format must be json or csv");
  if (!district) throw err(400, "district required");
  let ward;
  if (wardRaw) {
    ward = Number(wardRaw);
    if (!Number.isInteger(ward) || ward < 1 || ward > 33) throw err(400, "ward must be integer 1-33");
  }
  const tableName = env.TABLE_NAME;
  if (!tableName) throw err(500, "TABLE_NAME not configured");
  const ddb = getDdb();
  const pk = ward !== undefined ? `LEDGER#${district}#${ward}` : `LEDGER#${district}`;
  const rawItems = await queryLedger(ddb, tableName, pk);
  const items = rawItems.map(toLedgerItem);
  if (format === "csv") {
    const csv = toLedgerCsv(items);
    return { statusCode: 200, headers: { "content-type": "text/csv", "cache-control": "public, max-age=60" }, body: csv };
  }
  return { statusCode: 200, headers: { "content-type": "application/json", "cache-control": "public, max-age=60" }, body: JSON.stringify({ items }) };
}
