import { maskEmail, publicActorName } from "../lib/format.js";

// Defense in depth: even if a handler slips a raw email into a public audit field,
// mask any email-looking substring before it is served on the unauthenticated /audit feed.
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
function scrubEmails(value) {
  if (value === undefined || value === null) return value;
  return String(value).replace(EMAIL_RE, (m) => maskEmail(m));
}

export function toPublicAuditLine(it) {
  const label = it.targetLabel && String(it.targetLabel).trim() ? scrubEmails(String(it.targetLabel).trim()) : "—";
  const o = {
    ts: it.ts || it.createdAt,
    actorName: publicActorName(it),
    action: it.action,
    targetType: it.targetType,
    targetLabel: label,
  };
  if (it.reason) o.reason = scrubEmails(it.reason);
  return o;
}
