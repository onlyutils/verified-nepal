import { useEffect, useRef } from "react";

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

export function TurnstileWidget({ siteKey, onToken }: { siteKey: string; onToken: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;

    const render = () => {
      if (cancelled || !ref.current || !window.turnstile) return;
      try {
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(""),
          "error-callback": () => onTokenRef.current(""),
        });
      } catch {
        // ignore
      }
    };

    if (window.turnstile) {
      render();
      return () => {
        cancelled = true;
      };
    }

    const existing = document.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com/turnstile"]');
    if (existing) {
      existing.addEventListener("load", render, { once: true });
      return () => {
        cancelled = true;
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
    };
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={ref} className="mt-4" />;
}
