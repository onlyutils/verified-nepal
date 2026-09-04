import { useEffect, useState } from "react";
import { HandHeart, LayoutDashboard, PackageCheck, Settings, Users, Warehouse } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AppShell, type AppShellNavItem } from "@/components/app-shell";
import { EmptyState, LoadingState } from "@/components/empty-state";
import { Logo } from "@/components/logo";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import type { Language, Page } from "@/lib/types";
import { orgStatusLabel, statusTone, useOrg } from "./use-org";
import type { OrgSection } from "./org-types";
import { Overview } from "./overview";
import { Centers } from "./centers";
import { OrgNeeds } from "./needs";
import { Donations } from "./donations";
import { Team } from "./team";
import { SettingsSection } from "./settings";
import { OrgDialogs } from "./dialogs";

function sectionFromHash(): OrgSection {
  const value = typeof window === "undefined" ? "overview" : window.location.hash.slice(1);
  return ["overview", "centers", "donations", "team", "settings"].includes(value) ? (value as OrgSection) : "overview";
}

function Invites({ controller }: { controller: ReturnType<typeof useOrg> }) {
  const { t, invites, inviteActing, respondInvite } = controller;
  if (!invites.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.invitesTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {invites.map((invite) => (
          <div
            key={invite.orgId}
            className="flex flex-col gap-3 border-b pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm">{t.invitesFrom.replace("{org}", invite.orgName)}</p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={inviteActing === invite.orgId} onClick={() => void respondInvite(invite.orgId, true)}>
                {inviteActing === invite.orgId ? t.invitesAccepting : t.invitesAccept}
              </Button>
              <Button variant="outline" disabled={inviteActing === invite.orgId} onClick={() => void respondInvite(invite.orgId, false)}>
                {inviteActing === invite.orgId ? t.invitesDeclining : t.invitesDecline}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Gate({
  controller,
  navigate,
  setLanguage,
}: {
  controller: ReturnType<typeof useOrg>;
  navigate: (page: Page) => void;
  setLanguage: (language: Language) => void;
}) {
  const { auth, t, language } = controller;
  return (
    <div className="min-h-dvh bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-2xl items-center justify-between">
        <Button variant="ghost" className="h-auto p-1" onClick={() => navigate("dashboard")}>
          <Logo language={language} />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setLanguage(language === "en" ? "ne" : "en")}>
          <span lang={language === "en" ? "ne" : "en"}>{language === "en" ? "नेपाली" : "EN"}</span>
        </Button>
      </div>
      <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center py-8">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <CardTitle>{t.orgDashboardTitle}</CardTitle>
            <CardDescription>{t.orgDashboardGateBody}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {auth.clientId ? (
              <Button className="w-full" onClick={() => void auth.signIn()}>
                {t.registerOrgGateSignIn}
              </Button>
            ) : null}
            {auth.error ? (
              <Alert variant="destructive">
                <AlertDescription>{auth.error}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NoOrganization({ controller, navigate }: { controller: ReturnType<typeof useOrg>; navigate: (page: Page) => void }) {
  const { t } = controller;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader title={t.orgDashboardTitle} description={t.orgDashboardEmptyBody} />
      <Invites controller={controller} />
      <EmptyState
        title={t.orgDashboardEmptyTitle}
        description={t.orgDashboardEmptyBody}
        action={<Button onClick={() => navigate("registerOrg")}>{t.orgDashboardEmptyCta}</Button>}
      />
    </div>
  );
}

export function OrgDashboard({
  language,
  setLanguage,
  navigate,
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  navigate: (page: Page) => void;
}) {
  const controller = useOrg(language);
  const { auth, orgs, loadingOrgs, orgsError, t, selectedOrg, selectedId, setSelectedId } = controller;
  const [active, setActive] = useState<OrgSection>(sectionFromHash);

  useEffect(() => {
    const onHashChange = () => setActive(sectionFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const selectSection = (next: OrgSection) => {
    setActive(next);
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}#${next}`);
  };

  if (!auth.idToken) return <Gate controller={controller} navigate={navigate} setLanguage={setLanguage} />;
  if (loadingOrgs || orgs === null) return <LoadingState label={t.orgDashboardLoading} className="mx-auto mt-16 max-w-md" />;
  if (orgsError)
    return (
      <div className="mx-auto mt-16 flex max-w-md flex-col gap-4">
        <Alert variant="destructive">
          <AlertDescription>{orgsError}</AlertDescription>
        </Alert>
        <Button onClick={() => void controller.fetchOrgs()}>{t.tryAgain}</Button>
      </div>
    );
  if (!orgs.length) return <NoOrganization controller={controller} navigate={navigate} />;

  const nav: AppShellNavItem<OrgSection>[] = [
    { key: "overview", label: t.navOverview, icon: <LayoutDashboard /> },
    { key: "needs", label: t.navNeeds, icon: <HandHeart /> },
    { key: "centers", label: t.navCenters, icon: <Warehouse /> },
    { key: "donations", label: t.navDonations, icon: <PackageCheck /> },
    { key: "team", label: t.navTeam, icon: <Users /> },
    { key: "settings", label: t.navSettings, icon: <Settings /> },
  ];
  const aside = (
    <div className="space-y-3">
      {orgs.length > 1 ? (
        <div className="space-y-2">
          <Label htmlFor="orgSelector">{t.orgDashboardSelectorLabel}</Label>
          <NativeSelect id="orgSelector" value={selectedId ?? ""} onChange={(event) => setSelectedId(event.target.value)}>
            <NativeSelectOption value="">{t.orgDashboardSelectorLabel}</NativeSelectOption>
            {orgs.map((org) => (
              <NativeSelectOption key={org.id} value={org.id}>
                {org.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ) : null}
      {selectedOrg ? <StatusBadge tone={statusTone(selectedOrg.status)}>{orgStatusLabel(selectedOrg, t)}</StatusBadge> : null}
    </div>
  );

  return (
    <AppShell
      title={selectedOrg?.name ?? t.orgDashboardTitle}
      nav={nav}
      active={active}
      onSelect={selectSection}
      user={auth.profile}
      onSignOut={auth.signOut}
      signOutLabel={t.signOut}
      language={language}
      setLanguage={setLanguage}
      onHome={() => navigate("dashboard")}
      aside={aside}
    >
      {active === "overview" ? <Overview controller={controller} /> : null}
      {active === "needs" ? <OrgNeeds controller={controller} navigate={navigate} /> : null}
      {active === "centers" ? <Centers controller={controller} /> : null}
      {active === "donations" ? <Donations controller={controller} /> : null}
      {active === "team" ? <Team controller={controller} /> : null}
      {active === "settings" ? <SettingsSection controller={controller} /> : null}
      <OrgDialogs controller={controller} />
    </AppShell>
  );
}
