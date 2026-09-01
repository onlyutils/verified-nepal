import { randomBytes, createHash } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const CLAIM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function maskName(name) {
  if (!name || typeof name !== "string") return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first} ${last[0].toUpperCase()}.`;
}

export function maskEmail(email) {
  if (!email || typeof email !== "string") return "";
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const first = local[0] || "*";
  return `${first}***@${domain}`;
}

export function publicActorName(item) {
  const raw = (item.actorName ?? item.actorEmail ?? "").trim();
  if (!raw) return "Moderator";
  if (raw.includes("@")) {
    const at = raw.indexOf("@");
    const local = raw.slice(0, at);
    const domain = raw.slice(at + 1);
    if (!domain) return "Moderator";
    const first = local[0] || "*";
    return `${first}***@${domain}`;
  }
  return raw;
}

export function ttlSeconds(days = 30) {
  return Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
}

export function toExpiresAt(ttl) {
  return new Date(ttl * 1000).toISOString();
}

export function generateRefCode() {
  const bytes = randomBytes(9);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out.slice(0, 12);
}

export function generateClaimCode() {
  const bytes = randomBytes(5);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += CLAIM_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (out.length < 8) {
    const extra = randomBytes(2);
    for (const b of extra) {
      if (out.length >= 8) break;
      out += CLAIM_ALPHABET[b % CLAIM_ALPHABET.length];
    }
  }
  return out.slice(0, 8);
}

export function generateUpdateCode() {
  return generateRefCode();
}

export function hashUpdateCode(code) {
  return createHash("sha256").update(code).digest("hex");
}
