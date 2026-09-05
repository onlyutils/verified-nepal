import { useState } from "react";
import { useGoogleAuth } from "@/lib/auth";
import { uiStrings } from "@/i18n/ui";
import type { Language } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Google brand colours are Google's, not ours: hex is correct here (same as src/desk/login.tsx).
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.55-5.17 3.55-8.87z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

/** Compact "keep this in your account" card. Never blocks the flow; dismissed per session. */
export function SignInNudge({ language, title, body, id }: { language: Language; title: string; body: string; id: string }) {
  const auth = useGoogleAuth();
  const t = uiStrings[language];
  const key = `vn:nudge:${id}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });
  if (dismissed || auth.loading || auth.idToken || !auth.clientId) return null;
  return (
    <Card className="border-primary-soft-border bg-primary-soft">
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-base font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          <p className="mt-1 text-xs text-subtle">{t.nudgePrivacy}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" onClick={auth.signIn}>
            <GoogleMark />
            {t.nudgeContinueWithGoogle}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              try {
                sessionStorage.setItem(key, "1");
              } catch {}
              setDismissed(true);
            }}
          >
            {t.nudgeDismiss}
          </Button>
          <Button type="button" variant="ghost" asChild>
            <a href="/">{t.nudgeGoToLanding}</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
