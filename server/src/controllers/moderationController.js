import { json, err, parseBody, stripInternal } from "../lib/http.js";
import { isOutOfScope } from "../lib/auth.js";
import { recordAudit, getTargetLabelForAudit } from "../models/audit.js";
import {
  listPendingNeedsAndOffers, listAllNeedsAllStatuses, enrichWithDupCandidates,
  getPendingItemByIdEitherType, applyModerationEdits, moderatePendingItem,
  claimPendingItem, releaseClaim,
} from "../models/moderation.js";

export async function handleGetModerationQueue(event, opts) {
  const { auth } = opts;
  let pending = await listPendingNeedsAndOffers(auth.ddb, auth.tableName);
  if (auth.role === "moderator" && Array.isArray(auth.user?.districts) && auth.user.districts.length > 0) {
    pending = pending.filter((it) => !isOutOfScope(auth.user, it));
  }
  let needsAll = await listAllNeedsAllStatuses(auth.ddb, auth.tableName);
  if (needsAll.length === 0) {
    needsAll = pending.filter((it) => it.PK.startsWith("NEED#"));
  }
  const enriched = enrichWithDupCandidates(pending, needsAll);
  return json(200, { items: enriched.map(stripInternal) });
}

export async function handlePostModeration(event, opts, id) {
  const { auth } = opts;
  const body = parseBody(event);
  if (!body || typeof body !== "object") throw err(400, "invalid body");
  const { action, reason, edits } = body;
  if (!["publish", "reject"].includes(action)) throw err(400, 'action must be "publish" or "reject"');
  if (action === "reject") {
    if (!reason || typeof reason !== "string" || !reason.trim() || reason.trim().length < 5) throw err(400, "reason required for reject");
    if (reason.trim().length > 1000) throw err(400, "reason too long");
  }
  const tableName = auth.tableName;
  const ddb = auth.ddb;
  const { type, item } = await getPendingItemByIdEitherType(ddb, tableName, id);
  if (!item) throw err(404, "not found");
  if (isOutOfScope(auth.user, item)) throw err(403, "out_of_scope");
  if (item.status !== "pending") throw err(400, "only pending items can be moderated");
  if (edits && typeof edits === "object") applyModerationEdits(type, item, edits);
  const result = await moderatePendingItem(ddb, tableName, { id, type, item, action, reason, actorSub: auth.payload.sub });
  const actorName = auth.user?.name || auth.payload.name || "";
  const targetLabel = getTargetLabelForAudit(type, item);
  await recordAudit(ddb, tableName, {
    actorSub: auth.payload.sub, actorName, action, targetType: type, targetId: id,
    targetLabel, reason: reason ? String(reason).trim() : undefined,
  });
  const resp = { status: result.status };
  if (result.claimCode) resp.claimCode = result.claimCode;
  return json(200, resp);
}

export async function handlePostModerationClaim(event, opts, id) {
  const { auth } = opts;
  const { item } = await getPendingItemByIdEitherType(auth.ddb, auth.tableName, id);
  if (!item) throw err(404, "not found");
  if (isOutOfScope(auth.user, item)) throw err(403, "out_of_scope");
  if (item.status !== "pending") throw err(400, "only pending items can be claimed");
  const actorName = auth.user?.name || auth.payload.name || "";
  const result = await claimPendingItem(auth.ddb, auth.tableName, { item, actorSub: auth.payload.sub, actorName });
  return json(200, result);
}

export async function handlePostModerationRelease(event, opts, id) {
  const { auth } = opts;
  const { item } = await getPendingItemByIdEitherType(auth.ddb, auth.tableName, id);
  if (!item) throw err(404, "not found");
  await releaseClaim(auth.ddb, auth.tableName, { item, actorSub: auth.payload.sub });
  return json(200, { ok: true });
}
