export function hasAuthHeader(headers: unknown): boolean {
  if (!headers) return false;
  try {
    const h = headers as { has?: (k: string) => boolean; get?: (k: string) => unknown };
    if (typeof h.has === "function") {
      if (h.has("Authorization")) return true;
      if (h.has("authorization")) return true;
    }
    if (typeof h.get === "function") {
      if (h.get("Authorization")) return true;
      if (h.get("authorization")) return true;
    }
  } catch {}
  try {
    const rec = headers as Record<string, unknown>;
    if (rec["Authorization"] || rec["authorization"]) return true;
  } catch {}
  return false;
}

export function isPrivateApiPath(pathname: string): boolean {
  if (!pathname) return false;
  if (pathname === "/me" || pathname.startsWith("/me/")) return true;
  if (pathname === "/auth" || pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/moderation/")) return true;
  if (pathname.startsWith("/admin/")) return true;
  if (pathname === "/claims" || pathname.startsWith("/claims/")) return true;
  return false;
}

export function isPublicApiPath(pathname: string): boolean {
  if (!pathname) return false;
  if (pathname === "/needs" || pathname === "/offers" || pathname === "/ledger" || pathname === "/audit") return true;
  if (pathname === "/projects" || pathname.startsWith("/projects/")) return true;
  if (pathname === "/dispatches" || pathname.startsWith("/dispatches/")) return true;
  if (pathname.startsWith("/status/")) return true;
  return false;
}

function getPathname(url: URL | string): string {
  if (typeof url === "string") {
    try {
      return new URL(url, "http://localhost").pathname;
    } catch {
      return url.split("?")[0].split("#")[0];
    }
  }
  return url.pathname;
}

function getHeaders(input: { headers?: unknown; request?: unknown }): unknown {
  if (input.headers !== undefined) return input.headers;
  const req = input.request as { headers?: unknown } | undefined;
  if (req?.headers !== undefined) return req.headers;
  return undefined;
}

function getMethod(input: { method?: string; request?: unknown }): string {
  if (input.method) return input.method.toUpperCase();
  const req = input.request as { method?: string } | undefined;
  if (req?.method) return req.method.toUpperCase();
  return "GET";
}

export type CacheStrategy = "NetworkOnly" | "StaleWhileRevalidate";

export function classifyApiRequest(input: {
  url: URL | string;
  method?: string;
  headers?: unknown;
  request?: { method?: string; headers?: unknown } | Request;
}): CacheStrategy | null {
  const method = getMethod(input);
  const headers = getHeaders(input);
  const pathname = getPathname(input.url);
  if (method !== "GET") return "NetworkOnly";
  if (hasAuthHeader(headers)) return "NetworkOnly";
  if (isPrivateApiPath(pathname)) return "NetworkOnly";
  if (isPublicApiPath(pathname)) return "StaleWhileRevalidate";
  return null;
}

export function shouldUseNetworkOnly(
  url: URL | string,
  request?: { method?: string; headers?: unknown } | Request,
): boolean {
  return classifyApiRequest({ url, request }) === "NetworkOnly";
}

export function shouldUseStaleWhileRevalidate(
  url: URL | string,
  request?: { method?: string; headers?: unknown } | Request,
): boolean {
  return classifyApiRequest({ url, request }) === "StaleWhileRevalidate";
}
