import { useEffect, useRef, useState } from "react";
import { labels } from "./i18n";
import type { Language } from "./types";
import { fillTemplate } from "./edition";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type DeskProfile = {
  role?: string;
  name?: string;
  displayName?: string;
  email?: string;
};

export function Desk({ language }: { language: Language }) {
  const t = labels[language];
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const apiBase = import.meta.env.VITE_API_BASE as string | undefined;

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
      if ((window as unknown as { google?: unknown }).google) {
        init();
      } else {
        existing.addEventListener("load", init, { once: true });
      }
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
    if (!apiBase) {
      setLoading(false);
      setError(null);
      setProfile(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${apiBase.replace(/\/$/, "")}/me`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as DeskProfile & { user?: DeskProfile };
        const normalized = (data.user ?? data) as DeskProfile;
        return normalized;
      })
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
      })
      .catch(() => {
        if (cancelled) return;
        setError(t.deskErrorFailedToVerify);
        setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idToken, apiBase, t.deskErrorFailedToVerify]);

  const handleSignOut = () => {
    setIdToken(null);
    setProfile(null);
    setError(null);
    try {
      const g = (window as unknown as { google?: { accounts: { id: { disableAutoSelect: () => void } } } }).google;
      g?.accounts.id.disableAutoSelect();
    } catch {
      // ignore
    }
  };

  if (!idToken) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md items-center justify-center px-4 py-10">
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t.deskTitle}</CardTitle>
            <CardDescription>{t.deskInviteOnly}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {clientId ? (
              <>
                <div ref={buttonRef} className="flex justify-center" aria-label="Google sign-in" />
                <noscript>
                  <p className="font-sans text-sm text-muted-foreground">JavaScript required for sign-in.</p>
                </noscript>
              </>
            ) : (
              <p className="font-sans text-sm text-muted-foreground">{t.deskNotConfigured}</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md items-center justify-center px-4 py-10">
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle>{t.deskTitle}</CardTitle>
            <CardDescription>{t.deskChecking}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md items-center justify-center px-4 py-10">
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle>{t.deskTitle}</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={handleSignOut}>
              {t.deskSignOut}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const role = profile?.role;
  const isModerator = role === "moderator" || role === "admin";

  if (isModerator) {
    const displayName = profile?.displayName || profile?.name || profile?.email;
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="font-display text-2xl font-bold tracking-tight">{t.deskTitle}</h1>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            {t.deskSignOut}
          </Button>
        </div>
        {displayName ? (
          <p className="mb-4 font-sans text-sm text-muted-foreground">
            {fillTemplate(t.deskWelcome, { name: displayName })}
          </p>
        ) : null}
        <Separator className="mb-6" />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t.deskQueueTitle}
              <Badge variant="secondary">moderator</Badge>
            </CardTitle>
            <CardDescription>queue coming soon</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-sans text-sm leading-6 text-muted-foreground">{t.deskQueueBody}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md items-center justify-center px-4 py-10">
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle>{t.deskNotAuthorizedTitle}</CardTitle>
          <CardDescription>{t.deskNotAuthorizedBody}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {profile?.email || profile?.name ? (
            <p className="font-sans text-xs text-muted-foreground">
              {fillTemplate(t.deskWelcome, { name: String(profile.email || profile.name || "") })}
            </p>
          ) : null}
          <Button variant="outline" onClick={handleSignOut}>
            {t.deskSignOut}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
