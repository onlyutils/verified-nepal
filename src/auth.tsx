import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE, getMe } from "./api";

export interface DeskProfile {
  sub?: string;
  role?: string;
  name?: string;
  displayName?: string;
  email?: string;
}

export function useGoogleAuth() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const [idToken, setIdToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<DeskProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!clientId || idToken) return;
    const init = () => {
      const g = (window as unknown as { google?: { accounts: { id: { initialize: (o: unknown) => void; renderButton: (el: HTMLElement, opts: unknown) => void } } } }).google;
      if (!g?.accounts?.id || !buttonRef.current) return;
      try {
        g.accounts.id.initialize({
          client_id: clientId,
          callback: (resp: { credential: string }) => {
            const token = resp?.credential;
            if (token) setIdToken(token);
          },
        });
        g.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: "continue_with",
          width: 280,
        });
      } catch {
        // ignore GIS init errors
      }
    };
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      if ((window as unknown as { google?: unknown }).google) init();
      else existing.addEventListener("load", init, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = init;
    document.head.appendChild(script);
  }, [clientId, idToken]);

  useEffect(() => {
    if (!idToken) return;
    if (!API_BASE) {
      setLoading(false);
      setError(null);
      setProfile(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getMe(idToken)
      .then((data) => {
        if (cancelled) return;
        const raw = data as DeskProfile & { user?: DeskProfile };
        const normalized = (raw.user as DeskProfile) ?? (raw as DeskProfile);
        setProfile(normalized);
      })
      .catch(() => {
        if (cancelled) return;
        setError("verify-failed");
        setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idToken]);

  const signOut = useCallback(() => {
    setIdToken(null);
    setProfile(null);
    setError(null);
    try {
      const g = (window as unknown as { google?: { accounts: { id: { disableAutoSelect: () => void } } } }).google;
      g?.accounts.id.disableAutoSelect();
    } catch {
      // ignore
    }
  }, []);

  return { clientId, idToken, profile, loading, error, buttonRef, setError, signOut };
}
