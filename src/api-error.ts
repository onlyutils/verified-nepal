import { ApiError } from "./api";
import { labels } from "./i18n";
import type { Language } from "./types";

/** Plain-language message for any thrown API/network error. Never returns raw "Failed to fetch" or server codes. */
export function apiErrorMessage(err: unknown, language: Language): string {
  const t = labels[language];
  if (err instanceof ApiError) {
    const code = typeof (err.body as { error?: unknown } | null)?.error === "string" ? (err.body as { error: string }).error : err.message;
    if (code === "out_of_scope") return t.errOutOfScope;
    if (code === "guidelines_not_acknowledged") return t.errGuidelinesNotAcknowledged;
    if (err.status === 0 || err.status === 502 || err.status === 503 || err.status === 504) return t.errOffline;
    if (err.status === 401) return t.errSignedOut;
    if (err.status === 429) return t.errRateLimited;
    return t.errGeneric;
  }
  // fetch() rejects with a TypeError when the network is down or the request is blocked.
  if (err instanceof TypeError) return t.errOffline;
  return t.errGeneric;
}
