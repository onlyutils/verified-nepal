import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useGoogleAuth } from "@/lib/auth";
import { labels } from "@/i18n";
import { deskStrings } from "@/i18n/desk";
import { meStrings } from "@/i18n/me";
import type { Language, Page } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/logo";

const TEST_LOGIN_ENABLED = import.meta.env.VITE_ENABLE_TEST_LOGIN === "true";

/** Dev-only email/password form for the OnlyUtils fixture accounts in docs/BETA-TESTING.md. */
function TestLoginForm({ t, signInWithPassword, loading }: { t: (typeof labels)["en"]; signInWithPassword: (email: string, password: string) => void; loading: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        signInWithPassword(email, password);
      }}
    >
      <p className="text-center text-xs text-muted-foreground">{t.deskTestLoginToggle}</p>
      <label htmlFor="desk-test-email" className="sr-only">
        {t.deskQueueEmail}
      </label>
      <Input
        id="desk-test-email"
        type="email"
        placeholder={t.deskQueueEmail}
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="bg-background text-foreground"
        required
      />
      <label htmlFor="desk-test-password" className="sr-only">
        {t.deskTestLoginPassword}
      </label>
      <Input
        id="desk-test-password"
        type="password"
        placeholder={t.deskTestLoginPassword}
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="bg-background text-foreground"
        required
      />
      <Button type="submit" variant="outline" size="sm" className="w-full bg-background" disabled={loading}>
        {t.deskTestLoginSubmit}
      </Button>
    </form>
  );
}

/**
 * Background: Planet SkySat scene of the flood-widened Trishuli at Betrawati, five days after the
 * 26 August 2026 Bhote Koshi outburst flood. Planet's disaster data release is CC BY-NC 4.0 —
 * fine for this non-commercial volunteer site; keep the attribution when you change the image.
 */
const photo = {
  src: "/images/desk-login.jpg",
  title: "SkySat image of the Trishuli at Betrawati, 31 August 2026",
  author: "Planet Labs PBC",
  license: "CC BY-NC 4.0",
  url: "https://source.coop/planet/disasterdata/nepal-flash-flood-2026-08-26",
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
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

/** /desk/login — the site's single sign-in screen. Signed-in users are sent on to /desk. */
export function DeskLogin({
  language,
  setLanguage,
  navigate,
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  navigate: (page: Page) => void;
}) {
  const auth = useGoogleAuth();
  const t = labels[language];
  const ds = deskStrings[language];

  useEffect(() => {
    if (auth.idToken) navigate("desk");
  }, [auth.idToken, navigate]);

  return (
    <div className="relative flex min-h-dvh flex-col bg-foreground text-background">
      <img src={photo.src} alt="" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-foreground/60 via-foreground/45 to-foreground/80" aria-hidden="true" />

      <div className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Button
          variant="ghost"
          className="h-auto p-1 hover:bg-white/10"
          onClick={() => navigate("dashboard")}
          aria-label={ds.deskHomeLabel}
        >
          <Logo language={language} variant="light" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-white/40 bg-transparent text-background hover:bg-white/10 hover:text-background"
          onClick={() => setLanguage(language === "en" ? "ne" : "en")}
        >
          <span lang={language === "en" ? "ne" : "en"}>{language === "en" ? ds.deskNepali : ds.deskEnglish}</span>
        </Button>
      </div>

      <main id="main" tabIndex={-1} className="relative flex flex-1 items-center justify-center px-4 py-8 focus:outline-none">
        <Card className="w-full max-w-md border-transparent">
          <CardHeader className="text-center">
            <h1 className="text-2xl font-semibold leading-none tracking-tight">{meStrings[language].navSignIn}</h1>
            <CardDescription>{ds.deskLoginTagline}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {auth.clientId ? (
              <Button variant="outline" size="lg" className="w-full gap-3 bg-background" onClick={auth.signIn} disabled={auth.loading}>
                <GoogleMark />
                {t.deskContinueWithGoogle}
              </Button>
            ) : (
              <p className="text-center text-sm text-muted-foreground">{t.deskNotConfigured}</p>
            )}
            {auth.error ? (
              <Alert variant="destructive">
                <AlertDescription>{auth.error === "password-login-failed" ? t.deskTestLoginFailed : t.deskSignInFailed}</AlertDescription>
              </Alert>
            ) : null}
            {TEST_LOGIN_ENABLED ? (
              <>
                <div className="flex items-center gap-3" aria-hidden="true">
                  <Separator className="flex-1 w-auto shrink" />
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{t.deskLoginOrDivider}</span>
                  <Separator className="flex-1 w-auto shrink" />
                </div>
                <TestLoginForm t={t} signInWithPassword={auth.signInWithPassword} loading={auth.loading} />
              </>
            ) : null}
          </CardContent>
        </Card>
      </main>

      <p className="relative px-4 pb-4 pr-20 text-xs text-background/70 sm:px-6 sm:pr-24">
        <a
          href={photo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
        >
          {ds.deskLoginPhotoCredit.replace("{title}", photo.title).replace("{author}", photo.author).replace("{license}", photo.license)}
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      </p>
    </div>
  );
}
