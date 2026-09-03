import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import type { DeskModel } from "./use-desk";
import type { Language } from "@/lib/types";
import guidelinesRaw from "../../docs/MODERATION-GUIDELINES.md?raw";

function GateLayout({
  model,
  language,
  setLanguage,
  onHome,
  children,
}: {
  model: DeskModel;
  language: Language;
  setLanguage: (language: Language) => void;
  onHome: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-2xl items-center justify-between">
        <Button variant="ghost" className="h-auto p-1" onClick={onHome} aria-label={model.ds.deskHomeLabel}>
          <Logo language={language} />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setLanguage(language === "en" ? "ne" : "en")}>
          <span lang={language === "en" ? "ne" : "en"}>{language === "en" ? model.ds.deskNepali : model.ds.deskEnglish}</span>
        </Button>
      </div>
      <div className="flex min-h-[calc(100dvh-6rem)] items-center justify-center py-8">{children}</div>
    </div>
  );
}

export function SignedOutGate({
  model,
  language,
  setLanguage,
  onHome,
}: {
  model: DeskModel;
  language: Language;
  setLanguage: (language: Language) => void;
  onHome: () => void;
}) {
  return (
    <GateLayout model={model} language={language} setLanguage={setLanguage} onHome={onHome}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{model.t.deskTitle}</CardTitle>
          <CardDescription>{model.t.deskInviteOnly}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {model.auth.clientId ? (
            <Button className="w-full" onClick={model.auth.signIn} aria-label={model.t.deskContinueWithGoogle}>
              {model.t.deskContinueWithGoogle}
            </Button>
          ) : (
            <p className="text-center text-sm text-muted-foreground">{model.t.deskNotConfigured}</p>
          )}
          {model.auth.error ? (
            <Alert variant="destructive">
              <AlertDescription>{model.t.deskSignInFailed}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </GateLayout>
  );
}

export function AuthGate({
  model,
  language,
  setLanguage,
  onHome,
}: {
  model: DeskModel;
  language: Language;
  setLanguage: (language: Language) => void;
  onHome: () => void;
}) {
  return (
    <GateLayout model={model} language={language} setLanguage={setLanguage} onHome={onHome}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{model.t.deskAuthErrorTitle}</CardTitle>
          <CardDescription>{model.t.deskAuthErrorBody}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {model.auth.clientId ? <Button onClick={model.auth.signIn}>{model.t.deskContinueWithGoogle}</Button> : null}
          <Button variant="outline" onClick={model.auth.signOut}>
            {model.t.deskSignOut}
          </Button>
        </CardContent>
      </Card>
    </GateLayout>
  );
}

export function LoadingGate({
  model,
  language,
  setLanguage,
  onHome,
}: {
  model: DeskModel;
  language: Language;
  setLanguage: (language: Language) => void;
  onHome: () => void;
}) {
  return (
    <GateLayout model={model} language={language} setLanguage={setLanguage} onHome={onHome}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{model.t.deskTitle}</CardTitle>
          <CardDescription>{model.t.deskChecking}</CardDescription>
        </CardHeader>
      </Card>
    </GateLayout>
  );
}

export function UnauthorizedGate({
  model,
  language,
  setLanguage,
  onHome,
}: {
  model: DeskModel;
  language: Language;
  setLanguage: (language: Language) => void;
  onHome: () => void;
}) {
  return (
    <GateLayout model={model} language={language} setLanguage={setLanguage} onHome={onHome}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{model.t.deskNotAuthorizedTitle}</CardTitle>
          <CardDescription>{model.t.deskNotAuthorizedBody}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            {model.auth.profile?.email ? model.t.deskWelcome.replace("{name}", model.auth.profile.email) : ""}
          </p>
          <Button variant="outline" onClick={model.auth.signOut}>
            {model.t.deskSignOut}
          </Button>
        </CardContent>
      </Card>
    </GateLayout>
  );
}

export function GuidelinesGate({
  model,
  language,
  setLanguage,
  onHome,
}: {
  model: DeskModel;
  language: Language;
  setLanguage: (language: Language) => void;
  onHome: () => void;
}) {
  return (
    <div className="min-h-dvh bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-2xl items-center justify-between">
        <Button variant="ghost" className="h-auto p-1" onClick={onHome}>
          <Logo language={language} />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setLanguage(language === "en" ? "ne" : "en")}>
          <span lang={language === "en" ? "ne" : "en"}>{language === "en" ? model.ds.deskNepali : model.ds.deskEnglish}</span>
        </Button>
      </div>
      <div className="flex justify-center py-8">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>{model.t.deskGuidelinesGateTitle}</CardTitle>
            <CardDescription>{model.t.deskGuidelinesGateLead}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-[50vh] overflow-y-auto rounded-lg border bg-secondary p-4 text-sm leading-6 whitespace-pre-wrap">
              {guidelinesRaw}
            </div>
            {model.ackError ? (
              <Alert variant="destructive">
                <AlertDescription>{model.ackError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex items-start gap-3">
              <Checkbox
                id="guidelines-ack"
                checked={model.guidelinesChecked}
                onCheckedChange={(checked) => model.setGuidelinesChecked(checked === true)}
              />
              <Label htmlFor="guidelines-ack" className="leading-6">
                {model.ds.guidelinesAckCheckboxLabel}
              </Label>
            </div>
            <Button onClick={model.handleAck} disabled={model.ackLoading}>
              {model.ackLoading ? model.t.deskGuidelinesAcking : model.t.deskGuidelinesAckButton}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
