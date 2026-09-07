import { createHash, randomUUID } from "node:crypto";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { json, err, parseBody } from "../lib/http.js";
import { isOutOfScope } from "../lib/auth.js";
import { validateOptionalString, validateString } from "../lib/validate.js";
import { verifyTurnstile } from "../lib/turnstile.js";
import { getMissingById, listMissingByModerationStatus, listMissingTips } from "../models/missing.js";
import { putMissing } from "../models/missing.js";
import { recordAudit, getTargetLabelForAudit } from "../models/audit.js";
import { stripInternal } from "../lib/http.js";

const ID = /^[A-Za-z0-9_-]{1,64}$/;

function sourceKey(event, token) {
  const forwarded = Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === "x-forwarded-for")?.[1];
  const source = String(forwarded || event.requestContext?.http?.sourceIp || token || "unknown").split(",")[0].trim();
  return createHash("sha256").update(source).digest("hex");
}

export async function handleGetModerationMissing(event, opts) {
  const { auth } = opts;
  let items = await listMissingByModerationStatus(auth.ddb, auth.tableName, "pending");
  let allVisible = items;
  const published = await listMissingByModerationStatus(auth.ddb, auth.tableName, "published");
  allVisible = [...items, ...published];
  if (auth.role === "moderator") {
    items = items.filter((item) => !isOutOfScope(auth.user, item));
    allVisible = allVisible.filter((item) => !isOutOfScope(auth.user, item));
  }
  const pending = items.map((item) => {
    const duplicate = allVisible.some((other) => other.id !== item.id && other.district === item.district && other.name.trim().toLowerCase() === item.name.trim().toLowerCase());
    return { ...stripInternal(item), duplicateHint: duplicate };
  });
  return json(200, { items: pending });
}

export async function handlePostModerationMissing(event, opts, id) {
  const { auth } = opts;
  if (!ID.test(id)) throw err(400, "invalid id");
  const item = await getMissingById(auth.ddb, auth.tableName, id);
  if (!item) throw err(404, "not found");
  if (isOutOfScope(auth.user, item)) throw err(403, "out_of_scope");
  if (item.publicationStatus !== "pending") throw err(400, "only pending posters can be moderated");
  const body = parseBody(event) || {};
  const action = String(body.action || "").trim();
  if (!["publish", "reject"].includes(action)) throw err(400, "action must be publish or reject");
  const reason = body.reason === undefined ? "" : String(body.reason).trim();
  if (action === "reject" && !reason) throw err(400, "reason required");
  item.publicationStatus = action === "publish" ? "published" : "rejected";
  item.updatedAt = new Date().toISOString();
  item.gsi2pk = `MISSING#${item.publicationStatus}`;
  item.gsi2sk = item.updatedAt;
  if (action === "reject") item.rejectReason = reason;
  else delete item.rejectReason;
  await putMissing(auth.ddb, auth.tableName, item);
  await recordAudit(auth.ddb, auth.tableName, {
    actorSub: auth.payload.sub,
    actorName: auth.user?.name || auth.payload.name || "",
    action,
    targetType: "MISSING",
    targetId: id,
    targetLabel: getTargetLabelForAudit("MISSING", item),
    reason: action === "reject" ? reason : undefined,
  });
  return json(200, { status: item.publicationStatus });
}

export async function handlePostMissingTip(event, opts, id) {
  if (!ID.test(id)) throw err(400, "invalid id");
  const item = await getMissingById(opts.getDdb(), opts.env.TABLE_NAME, id);
  if (!item || item.publicationStatus !== "published") throw err(404, "not found");
  const body = parseBody(event) || {};
  const message = validateString(body.message, "message", 1, 1000);
  const contact = validateOptionalString(body.contact, "contact", 0, 200) || "";
  await verifyTurnstile(body.turnstileToken, opts.env.TURNSTILE_SECRET, { required: opts.env.REQUIRE_TURNSTILE === "1" });
  const rateKey = sourceKey(event, body.turnstileToken);
  const cutoff = Date.now() - 60 * 60 * 1000;
  const tips = await listMissingTips(opts.getDdb(), opts.env.TABLE_NAME, id);
  const recent = tips.filter((tip) => tip.rateKey === rateKey && new Date(tip.createdAt).getTime() >= cutoff);
  if (recent.length >= 5) throw err(429, "too many tips");
  const now = new Date().toISOString();
  const tip = {
    PK: `MISSING#${id}`,
    SK: `TIP#${now}#${randomUUID()}`,
    type: "MISSING_TIP",
    id: randomUUID(),
    posterId: id,
    message,
    createdAt: now,
    rateKey,
    expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 90,
  };
  if (contact) tip.contact = contact;
  await opts.getDdb().send(new PutCommand({ TableName: opts.env.TABLE_NAME, Item: tip }));
  return json(201, { ok: true });
}

export async function handleGetMissingTips(event, opts, id) {
  const { auth } = opts;
  if (!ID.test(id)) throw err(400, "invalid id");
  const item = await getMissingById(auth.ddb, auth.tableName, id);
  if (!item) throw err(404, "not found");
  if (item.createdBy !== auth.payload.sub) throw err(403, "forbidden");
  const items = (await listMissingTips(auth.ddb, auth.tableName, id)).map((tip) => ({ id: tip.id, message: tip.message, contact: tip.contact, createdAt: tip.createdAt }));
  return json(200, { items, count: items.length });
}
