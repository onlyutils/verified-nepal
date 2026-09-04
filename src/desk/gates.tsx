import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { districtLabels, districtNames } from "@/lib/geo";
import type { DeskModel } from "./use-desk";
import type { Language } from "@/lib/types";
import guidelinesRaw from "../../docs/MODERATION-GUIDELINES.md?raw";

export function DistrictCheckboxes({
  selected,
  onChange,
  language,
}: {
  selected: string[];
  onChange: (districts: string[]) => void;
  language: Language;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {districtNames.map((district) => (
        <Label key={district} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3">
          <Checkbox
            checked={selected.includes(district)}
            onCheckedChange={(checked) =>
              onChange(checked ? [...selected, district] : selected.filter((value) => value !== district))
            }
          />
          {districtLabels[district][language]}
        </Label>
      ))}
    </div>
  );
}

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
  onOrg,
}: {
  model: DeskModel;
  language: Language;
  setLanguage: (language: Language) => void;
  onHome: () => void;
  onOrg: () => void;
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
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={onOrg}>{model.ds.deskGoToOrg}</Button>
            <Button variant="outline" onClick={model.auth.signOut}>
              {model.t.deskSignOut}
            </Button>
          </div>
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

export function DistrictGate({
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
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <GateLayout model={model} language={language} setLanguage={setLanguage} onHome={onHome}>
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{model.ds.deskDistrictGateTitle}</CardTitle>
          <CardDescription>{model.ds.deskDistrictGateLead}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DistrictCheckboxes selected={selected} onChange={setSelected} language={language} />
          {model.districtError ? (
            <Alert variant="destructive">
              <AlertDescription>{model.districtError}</AlertDescription>
            </Alert>
          ) : null}
          <Button onClick={() => model.handleSetDistricts(selected)} disabled={model.districtSaving || selected.length === 0}>
            {model.districtSaving ? model.ds.deskDistrictGateSaving : model.ds.deskDistrictGateSave}
          </Button>
        </CardContent>
      </Card>
    </GateLayout>
  );
}
