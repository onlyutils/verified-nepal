import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE, getMe } from "@/lib/api";
import { clearTokens, isTokenExpired, loadTokens, refreshAccessToken, saveTokens, TOKENS_EVENT } from "@/lib/tokens";

export interface DeskProfile {
  sub?: string;
  role?: string;
  name?: string;
  displayName?: string;
  email?: string;
  districts?: string[];
  guidelinesAckAt?: string;
}

const AUTH_HOST = "https://auth.onlyutils.com";
const PKCE_VERIFIER_KEY = "pkce_verifier";
const PKCE_STATE_KEY = "pkce_state";
type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  orgs?: { id: string; name: string }[];
};

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = b64url(verifierBytes);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = b64url(new Uint8Array(digest));
  return { verifier, challenge };
}

export function useGoogleAuth() {
  const clientId = import.meta.env.VITE_OU_CLIENT_ID as string | undefined;
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    try {
      const t = loadTokens();
      return t?.access_token ?? null;
    } catch {
      return null;
    }
  });
  const [profile, setProfile] = useState<DeskProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setAccessToken(loadTokens()?.access_token ?? null);
    window.addEventListener(TOKENS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(TOKENS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const signIn = useCallback(async () => {
    if (!clientId) return;
    const { verifier, challenge } = await pkcePair();
    const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
    sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
    sessionStorage.setItem(PKCE_STATE_KEY, state);
    try {
      if (window.location.pathname.startsWith("/desk")) sessionStorage.removeItem("vn:return_to");
      else sessionStorage.setItem("vn:return_to", window.location.pathname + window.location.search);
    } catch {}
    const redirectUri = window.location.origin + "/desk";
    const authorizeUrl =
      `${AUTH_HOST}/authorize?` +
      new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        code_challenge: challenge,
        code_challenge_method: "S256",
        state,
        provider: "google",
      });
    window.location.assign(authorizeUrl);
  }, [clientId]);

  const signOut = useCallback(() => {
    clearTokens();
    sessionStorage.removeItem(PKCE_VERIFIER_KEY);
    sessionStorage.removeItem(PKCE_STATE_KEY);
    setAccessToken(null);
    setProfile(null);
    setError(null);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const stateParam = params.get("state");
    const providerError = params.get("error");

    const stripParams = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("code");
      url.searchParams.delete("state");
      url.searchParams.delete("error");
      url.searchParams.delete("error_description");
      const newSearch = url.searchParams.toString();
      const newUrl = url.pathname + (newSearch ? `?${newSearch}` : "") + url.hash;
      window.history.replaceState({}, "", newUrl);
    };

    // The provider redirects back with ?error=... when it refuses the sign-in
    // (e.g. an email not on a dev client's test audience); without this the
    // gate renders signed-out with no explanation.
    if (!code || !stateParam) {
      if (providerError) {
        setError(providerError);
        stripParams();
      }
      return;
    }

    const savedState = sessionStorage.getItem(PKCE_STATE_KEY);
    const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);

    if (!savedState || stateParam !== savedState || !verifier) {
      setError("verify-failed");
      stripParams();
      return;
    }

    const redirectUri = window.location.origin + "/desk";
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            code_verifier: verifier,
            redirect_uri: redirectUri,
          }),
        });
        if (!res.ok) {
          let message = "Sign-in failed";
          try {
            const data = (await res.json()) as { message?: string; error?: string };
            message = data.message || data.error || message;
          } catch {}
          throw new Error(message);
        }
        const tokens = (await res.json()) as TokenResponse;
        saveTokens(tokens);
        sessionStorage.removeItem(PKCE_VERIFIER_KEY);
        sessionStorage.removeItem(PKCE_STATE_KEY);
        if (cancelled) return;
        stripParams();
        setAccessToken(tokens.access_token);
        try {
          const returnTo = sessionStorage.getItem("vn:return_to");
          if (
            typeof returnTo === "string" &&
            returnTo.startsWith("/") &&
            !returnTo.startsWith("//") &&
            returnTo !== "/desk" &&
            !returnTo.startsWith("/desk/")
          ) {
            sessionStorage.removeItem("vn:return_to");
            window.location.replace(returnTo);
          }
        } catch {}
      } catch {
        if (cancelled) return;
        setError("verify-failed");
        stripParams();
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  useEffect(() => {
    if (!accessToken) {
      setProfile(null);
      setLoading(false);
      // Keep any error the exchange effect just set (e.g. a provider
      // ?error= redirect) — signOut clears errors itself.
      return;
    }
    if (!API_BASE) {
      setLoading(false);
      setError(null);
      setProfile(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    const tryRefresh = async (): Promise<boolean> => {
      if (!loadTokens()?.refresh_token) return false;
      const fresh = await refreshAccessToken(API_BASE);
      if (cancelled) return true;
      if (!fresh) {
        setAccessToken(loadTokens()?.access_token ?? null);
        setProfile(null);
        setError(null);
        return true;
      }
      setAccessToken(fresh);
      try {
        const data2 = await getMe(fresh);
        if (cancelled) return true;
        const raw2 = data2 as DeskProfile & { user?: DeskProfile };
        setProfile((raw2.user as DeskProfile) ?? (raw2 as DeskProfile));
        setError(null);
      } catch {
        if (cancelled) return true;
        setProfile(null);
        setError(null);
      }
      return true;
    };

    const fetchProfile = async () => {
      if (isTokenExpired(accessToken)) {
        const handled = await tryRefresh();
        if (handled) {
          if (!cancelled) setLoading(false);
          return;
        }
        if (!cancelled) {
          clearTokens();
          setAccessToken(null);
          setProfile(null);
          setError(null);
          setLoading(false);
        }
        return;
      }
      try {
        const data = await getMe(accessToken);
        if (cancelled) return;
        const raw = data as DeskProfile & { user?: DeskProfile };
        const normalized = (raw.user as DeskProfile) ?? (raw as DeskProfile);
        setProfile(normalized);
        setError(null);
      } catch (e) {
        const err = e as { status?: number };
        if (err?.status === 401) {
          const handled = await tryRefresh();
          if (handled) {
            if (!cancelled) setLoading(false);
            return;
          }
          if (cancelled) return;
          clearTokens();
          setAccessToken(null);
          setProfile(null);
          setError(null);
          return;
        }
        if (cancelled) return;
        setProfile(null);
        setError(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [accessToken, clientId]);

  return {
    clientId,
    idToken: accessToken,
    accessToken,
    profile,
    setProfile,
    loading,
    error,
    buttonRef,
    signIn,
    signOut,
    setError,
  };
}

export const useAuth = useGoogleAuth;
