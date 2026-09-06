import { useEffect, useRef, useState } from "react";
import { turnstileStrings } from "@/i18n/turnstile";
import type { Language } from "@/lib/types";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (t: string) => void; "expired-callback"?: () => void; "error-callback"?: () => void },
      ) => string;
      reset: (id: string) => void;
      remove?: (id: string) => void;
    };
    onTurnstileCallback?: () => void;
  }
}

export function TurnstileWidget({
  siteKey,
  language,
  onToken,
  verificationError = false,
  resetKey = 0,
}: {
  siteKey: string;
  language: Language;
  onToken: (t: string) => void;
  verificationError?: boolean;
  resetKey?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [loadError, setLoadError] = useState(false);
  const strings = turnstileStrings[language];
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    let timeout: number | undefined;
    setLoadError(false);

    const render = () => {
      if (cancelled || !ref.current || !window.turnstile) return;
      try {
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(""),
          "error-callback": () => {
            onTokenRef.current("");
            setLoadError(true);
          },
        });
      } catch {
        setLoadError(true);
      }
    };

    timeout = window.setTimeout(() => {
      if (!widgetId.current) setLoadError(true);
    }, 10000);

    if (window.turnstile) {
      render();
      return () => {
        cancelled = true;
        if (timeout) window.clearTimeout(timeout);
      };
    }

    const existing = document.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com/turnstile"]');
    if (existing) {
      existing.addEventListener("load", render, { once: true });
      return () => {
        cancelled = true;
        if (timeout) window.clearTimeout(timeout);
      };
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = render;
    document.head.appendChild(script);
    return () => {
      cancelled = true;
      if (timeout) window.clearTimeout(timeout);
    };
  }, [siteKey]);

  useEffect(() => {
    if (!resetKey || !widgetId.current || !window.turnstile) return;
    onTokenRef.current("");
    setLoadError(false);
    window.turnstile.reset(widgetId.current);
  }, [resetKey]);

  if (!siteKey) return null;
  return (
    <div ref={ref} className="mt-4" role="region" aria-label={strings.label}>
      {loadError ? <p className="text-sm text-destructive">{strings.loadError}</p> : null}
      {verificationError ? <p className="text-sm text-destructive">{strings.expiredError}</p> : null}
      {!loadError && !verificationError ? <p className="text-sm text-muted-foreground">{strings.completeHint}</p> : null}
    </div>
  );
}
