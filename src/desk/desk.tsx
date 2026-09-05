import { useEffect, useState } from "react";
import { Building2, Camera, Flag, FolderKanban, Globe, Inbox, LayoutList, Newspaper, Printer, RefreshCw, ShieldCheck, Siren } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppShell, type AppShellNavItem } from "@/components/app-shell";
import type { Language, Page } from "@/lib/types";
import { Admin } from "./admin";
import { Boards } from "./boards";
import { ClimateStats } from "./climate";
import { DeskDialogs } from "./dialogs";
import { Dispatches } from "./dispatches";
import { Stories } from "./stories";
import { AuthGate, DistrictCheckboxes, DistrictGate, GuidelinesGate, LoadingGate, SignedOutGate, UnauthorizedGate } from "./gates";
import { Flags } from "./flags";
import { Incidents } from "./incidents";
import { Organizations } from "./orgs";
import { PrintClaims } from "./print";
import { Projects } from "./projects";
import { Queue } from "./queue";
import { Sync } from "./sync";
import { useDesk, type DeskSection } from "./use-desk";

export function Desk({
  language,
  setLanguage,
  navigate,
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  navigate: (page: Page) => void;
}) {
  const model = useDesk(language);
  const { auth, t } = model;
  const [districtEditDraft, setDistrictEditDraft] = useState<string[]>([]);
  const onHome = () => navigate("dashboard");
  const isModerator = auth.profile?.role === "moderator" || auth.profile?.role === "admin";

  // Helpers (organization accounts) have no business on the Desk: send them to My organization.
  useEffect(() => {
    if (auth.idToken && auth.profile && !auth.error && !isModerator) navigate("org");
  }, [auth.idToken, auth.profile, auth.error, isModerator, navigate]);

  // Signed out: the login page owns the Google button.
  useEffect(() => {
    const returningFromOAuth = new URLSearchParams(window.location.search).has("code");
    if (!auth.loading && !auth.idToken && !returningFromOAuth) navigate("deskLogin");
  }, [auth.loading, auth.idToken, navigate]);

  if (auth.loading) return <LoadingGate model={model} language={language} setLanguage={setLanguage} onHome={onHome} />;
  if (!auth.idToken) return <SignedOutGate model={model} language={language} setLanguage={setLanguage} onHome={onHome} />;
  if (auth.error || !auth.profile) return <AuthGate model={model} language={language} setLanguage={setLanguage} onHome={onHome} />;
  if (auth.profile.role !== "moderator" && auth.profile.role !== "admin")
    return <UnauthorizedGate model={model} language={language} setLanguage={setLanguage} onHome={onHome} onOrg={() => navigate("org")} />;
  if (auth.profile.role === "moderator" && !model.ackedNow && !auth.profile.guidelinesAckAt)
    return <GuidelinesGate model={model} language={language} setLanguage={setLanguage} onHome={onHome} />;
  if (auth.profile.role === "moderator" && (auth.profile.districts?.length ?? 0) === 0)
    return <DistrictGate model={model} language={language} setLanguage={setLanguage} onHome={onHome} />;

  const nav: AppShellNavItem<DeskSection>[] = [
    { key: "queue", label: t.deskQueueNeedsTab, count: model.queue.length, icon: <Inbox /> },
    { key: "boards", label: t.deskBoardsTab, icon: <LayoutList /> },
    { key: "print", label: t.deskPrintTab, icon: <Printer /> },
    { key: "sync", label: t.deskSyncTab, icon: <RefreshCw /> },
    { key: "flags", label: t.deskFlagsTab, count: model.flags.length, icon: <Flag /> },
    { key: "projects", label: t.deskProjectsTab, count: model.projectsCount, icon: <FolderKanban /> },
    { key: "dispatches", label: t.deskDispatchesTab, count: model.dispatches.length, icon: <Newspaper /> },
    { key: "stories", label: model.ds.deskStoriesTab, count: model.stories.length, icon: <Camera /> },
    { key: "orgs", label: model.dos.orgsTab, count: model.orgsPendingCount, icon: <Building2 /> },
    ...(auth.profile.role === "admin"
      ? [
          { key: "incidents" as DeskSection, label: model.ds.deskIncidentsTab, icon: <Siren /> },
          { key: "admin" as DeskSection, label: t.deskAdminTab, icon: <ShieldCheck /> },
          { key: "climate" as DeskSection, label: model.ds.deskClimateTab, icon: <Globe /> },
        ]
      : []),
  ];
  const scopeText = model.isScoped ? t.deskScopeBadge.replace("{districts}", model.scopeLabel) : t.deskScopeAll;
  const aside = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="info">{scopeText}</Badge>
        {auth.profile.role === "moderator" ? (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => {
              setDistrictEditDraft(auth.profile?.districts ?? []);
              model.setDistrictEditOpen(true);
            }}
          >
            {model.ds.deskScopeEdit}
          </Button>
        ) : null}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{model.ds.deskScopeHint}</p>
    </div>
  );

  return (
    <AppShell
      title={t.deskTitle}
      nav={nav}
      active={model.activeSection}
      onSelect={model.setActiveSection}
      user={{ name: auth.profile.displayName || auth.profile.name, email: auth.profile.email }}
      onProfile={() => navigate("me")}
      profileLabel={t.deskMyProfile}
      onSignOut={auth.signOut}
      signOutLabel={t.deskSignOut}
      language={language}
      setLanguage={setLanguage}
      onHome={onHome}
      aside={aside}
    >
      <div className="space-y-4">
        <h1 className="sr-only">{t.deskTitle}</h1>
        {model.actionError ? (
          <Alert variant="destructive">
            <AlertDescription>{model.actionError}</AlertDescription>
          </Alert>
        ) : null}
        {model.actionMsg ? (
          <Alert aria-live="polite">
            <AlertDescription>{model.actionMsg}</AlertDescription>
          </Alert>
        ) : null}
        {model.activeSection === "queue" ? <Queue model={model} /> : null}
        {model.activeSection === "boards" ? <Boards model={model} /> : null}
        {model.activeSection === "print" ? <PrintClaims model={model} /> : null}
        {model.activeSection === "sync" ? <Sync model={model} /> : null}
        {model.activeSection === "flags" ? <Flags model={model} /> : null}
        {model.activeSection === "projects" ? <Projects model={model} /> : null}
        {model.activeSection === "dispatches" ? <Dispatches model={model} /> : null}
        {model.activeSection === "stories" ? <Stories model={model} /> : null}
        {model.activeSection === "orgs" ? <Organizations model={model} /> : null}
        {model.activeSection === "incidents" && auth.profile.role === "admin" ? <Incidents model={model} /> : null}
        {model.activeSection === "admin" && auth.profile.role === "admin" ? <Admin model={model} /> : null}
        {model.activeSection === "climate" && auth.profile.role === "admin" ? <ClimateStats model={model} /> : null}
        <DeskDialogs model={model} />
        <Dialog open={model.districtEditOpen} onOpenChange={model.setDistrictEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{model.ds.deskScopeEdit}</DialogTitle>
            </DialogHeader>
            <DistrictCheckboxes
              selected={districtEditDraft}
              onChange={setDistrictEditDraft}
              language={language}
              searchPlaceholder={model.ds.deskDistrictSearchPlaceholder}
            />
            {model.districtError ? (
              <Alert variant="destructive">
                <AlertDescription>{model.districtError}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => model.setDistrictEditOpen(false)}>
                {t.deskCancel}
              </Button>
              <Button
                onClick={() => model.handleSetDistricts(districtEditDraft)}
                disabled={model.districtSaving || districtEditDraft.length === 0}
              >
                {model.districtSaving ? model.ds.deskDistrictGateSaving : model.ds.deskDistrictGateSave}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
