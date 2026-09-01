import { publicActorName } from "../lib/format.js";

export function toPublicAuditLine(it) {
  const o = {
    ts: it.ts || it.createdAt,
    actorName: publicActorName(it),
    action: it.action,
    targetType: it.targetType,
    targetLabel: it.targetLabel && String(it.targetLabel).trim() ? String(it.targetLabel).trim() : "—",
  };
  if (it.reason) o.reason = it.reason;
  return o;
}
