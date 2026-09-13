// Relative .ts imports keep the Node test runner independent of the Vite "@/" alias.
import { postReach, type ReachPayload } from "./api.ts";
import type { Language } from "./types.ts";
import type { AppPage } from "./page-routing.ts";

const SESSION_KEY = "verifiednepal:reach-session";
let lastRecordedLocation: string | null = null;

export function buildReachPayload(input: {
  page: AppPage;
  pathname: string;
  search: string;
  referrer: string;
  host: string;
  language: Language;
  firstInSession: boolean;
}): ReachPayload | null {
  if (input.page === "desk" || input.page === "deskLogin" || input.page === "org") return null;

  let path = input.pathname;
  if (input.page === "floodImpact") {
    const loc = new URLSearchParams(input.search).get("loc");
    if (loc !== null) path += `?loc=${encodeURIComponent(loc)}`;
  }
  path = path.slice(0, 200);

  const payload: ReachPayload = {
    page: input.page,
    path,
    lang: input.language,
    newSession: input.firstInSession,
  };
  if (input.firstInSession) {
    try {
      const referrerHost = new URL(input.referrer).hostname;
      if (referrerHost && referrerHost !== input.host) payload.ref = referrerHost;
    } catch {
      // An empty or malformed referrer is not useful reach data.
    }
  }
  return payload;
}

export function recordPageView(page: AppPage): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (page === "desk" || page === "deskLogin" || page === "org") return;

  const locationKey = window.location.pathname + window.location.search;
  if (locationKey === lastRecordedLocation) return;

  let firstInSession = false;
  try {
    firstInSession = window.sessionStorage.getItem(SESSION_KEY) === null;
    if (firstInSession) window.sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // Storage can be disabled; avoid claiming a new session when it is unavailable.
    firstInSession = false;
  }

  const language: Language = document.documentElement.lang === "ne" ? "ne" : "en";
  const payload = buildReachPayload({
    page,
    pathname: window.location.pathname,
    search: window.location.search,
    referrer: document.referrer,
    host: window.location.hostname,
    language,
    firstInSession,
  });
  if (!payload) return;

  lastRecordedLocation = locationKey;
  void postReach(payload).catch(() => {});
}
