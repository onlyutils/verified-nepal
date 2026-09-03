import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { json, err, parseBody } from "../lib/http.js";
import { requireAuth } from "../lib/auth.js";
import { validateString } from "../lib/validate.js";
import { getRefPointer } from "../models/need.js";
import { listPointers, putPointer } from "../models/mine.js";
import { toMyMissing, toMyNeed, toMyOffer } from "../views/mine.js";

export async function handleGetDashboard(event, opts) {
  const auth = await requireAuth(event, opts);
  const { ddb, tableName, payload } = auth;
  const pointers = await listPointers(ddb, tableName, payload.sub);
  const out = { missing: [], needs: [], offers: [] };
  // A person owns tens of items, not thousands; one read per pointer keeps this simple.
  for (const p of pointers) {
    const res = await ddb.send(new GetCommand({ TableName: tableName, Key: { PK: `${p.kind}#${p.id}`, SK: "META" } }));
    const item = res.Item;
    if (!item) continue;
    if (p.kind === "NEED") out.needs.push(toMyNeed(item));
    else if (p.kind === "OFFER") out.offers.push(toMyOffer(item));
    else if (p.kind === "MISSING") out.missing.push(toMyMissing(item));
  }
  return json(200, out);
}

export async function handlePostNeedClaim(event, opts) {
  const auth = await requireAuth(event, opts);
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const refCode = validateString(body.refCode, "refCode", 1, 32).toUpperCase();
  const ref = await getRefPointer(auth.ddb, auth.tableName, refCode);
  if (!ref || !ref.needId) throw err(404, "not found");
  await putPointer(auth.ddb, auth.tableName, { sub: auth.payload.sub, type: "NEED", id: ref.needId });
  return json(200, { ok: true, id: ref.needId });
}
