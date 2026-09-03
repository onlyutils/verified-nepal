// Shared token store for the OnlyUtils session. localStorage (not
// sessionStorage) so the sign-in survives closed tabs and is shared across
// tabs; TOKENS_EVENT lets every useGoogleAuth() instance follow changes made
// here or by the request helper's 401 retry (src/lib/api.ts).
export interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}

const TOKEN_KEY = "ou_tokens";
export const TOKENS_EVENT = "vn:tokens";

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadTokens(): Tokens | null {
  try {
    const raw = storage()?.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Tokens;
    return parsed?.access_token && parsed?.refresh_token ? parsed : null;
  } catch {
    return null;
  }
}

function notify() {
  try {
    globalThis.dispatchEvent?.(new Event(TOKENS_EVENT));
  } catch {}
}

export function saveTokens(t: Tokens): void {
  storage()?.setItem(TOKEN_KEY, JSON.stringify({ access_token: t.access_token, refresh_token: t.refresh_token, expires_in: t.expires_in }));
  notify();
}

export function clearTokens(): void {
  storage()?.removeItem(TOKEN_KEY);
  notify();
}

export function isTokenExpired(token: string, skewMs = 0): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) b64 += "=".repeat(4 - pad);
    const payload = JSON.parse(atob(b64));
    if (typeof payload.exp !== "number") return false;
    return payload.exp * 1000 - skewMs <= Date.now();
  } catch {
    return false;
  }
}

let inflight: Promise<string | null> | null = null;

/**
 * Returns a usable access token, refreshing through the API when needed.
 * `failedToken` is the token a request just got a 401 with: if storage already
 * holds a different one (another request refreshed first) that is returned
 * without a network call. Concurrent callers share one refresh. A refresh the
 * server rejects clears the session and resolves null.
 */
export function refreshAccessToken(apiBase: string, failedToken?: string): Promise<string | null> {
  const stored = loadTokens();
  if (!stored) return Promise.resolve(null);
  if (failedToken && stored.access_token !== failedToken && !isTokenExpired(stored.access_token)) {
    return Promise.resolve(stored.access_token);
  }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(`${apiBase}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: stored.refresh_token }),
      });
      if (!res.ok) {
        clearTokens();
        return null;
      }
      const next = (await res.json()) as Tokens;
      // ponytail: some providers do not rotate refresh tokens; keep the old one then.
      saveTokens({ ...next, refresh_token: next.refresh_token || stored.refresh_token });
      return next.access_token;
    } catch {
      return null; // network blip: keep the session, caller surfaces the error
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
