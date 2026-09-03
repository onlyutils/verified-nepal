import { useEffect } from "react";
import { Building2, Flag, FolderKanban, Globe, Inbox, LayoutList, Newspaper, Printer, RefreshCw, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AppShell, type AppShellNavItem } from "@/components/app-shell";
import type { Language, Page } from "@/lib/types";
import { Admin } from "./admin";
import { Boards } from "./boards";
import { ClimateStats } from "./climate";
import { DeskDialogs } from "./dialogs";
import { Dispatches } from "./dispatches";
import { AuthGate, GuidelinesGate, LoadingGate, SignedOutGate, UnauthorizedGate } from "./gates";
import { Flags } from "./flags";
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

  const nav: AppShellNavItem<DeskSection>[] = [
    { key: "queue", label: t.deskQueueNeedsTab, count: model.queue.length, icon: <Inbox /> },
    { key: "boards", label: t.deskBoardsTab, icon: <LayoutList /> },
    { key: "print", label: t.deskPrintTab, icon: <Printer /> },
    { key: "sync", label: t.deskSyncTab, icon: <RefreshCw /> },
    { key: "flags", label: t.deskFlagsTab, count: model.flags.length, icon: <Flag /> },
    { key: "projects", label: t.deskProjectsTab, count: model.projectsCount, icon: <FolderKanban /> },
    { key: "dispatches", label: t.deskDispatchesTab, count: model.dispatches.length, icon: <Newspaper /> },
    { key: "orgs", label: model.dos.orgsTab, count: model.orgsPendingCount, icon: <Building2 /> },
    ...(auth.profile.role === "admin"
      ? [
          { key: "admin" as DeskSection, label: t.deskAdminTab, icon: <ShieldCheck /> },
          { key: "climate" as DeskSection, label: model.ds.deskClimateTab, icon: <Globe /> },
        ]
      : []),
  ];
  const scopeText = model.isScoped ? t.deskScopeBadge.replace("{districts}", model.scopeLabel) : t.deskScopeAll;
  const aside = (
    <div className="space-y-2">
      <Badge variant="info">{scopeText}</Badge>
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
        {model.activeSection === "orgs" ? <Organizations model={model} /> : null}
        {model.activeSection === "admin" && auth.profile.role === "admin" ? <Admin model={model} /> : null}
        {model.activeSection === "climate" && auth.profile.role === "admin" ? <ClimateStats model={model} /> : null}
        <DeskDialogs model={model} />
      </div>
    </AppShell>
  );
}
