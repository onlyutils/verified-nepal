import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Dashboard } from "@/pages/home";
import { ComponentErrorBoundary } from "@/components/error-boundary";
import { BackToTop } from "@/components/back-to-top";
import { EmergencyBar } from "@/components/emergency-bar";
import { NotFound } from "@/components/not-found";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteStatusBar } from "@/components/site-status-bar";
import { LiveDataProvider } from "@/lib/live";
import { labels } from "@/i18n";
import { posterStrings } from "@/i18n/poster";
import { meStrings } from "@/i18n/me";
import { shellStrings } from "@/i18n/shell";
import { orgStrings } from "@/i18n/orgs";
import { centerStrings } from "@/i18n/centers";
import { climateStrings } from "@/i18n/climate";
import { ourMessageStrings } from "@/i18n/our-message";
import { disasterStrings } from "@/i18n/disasters";
import { articlesEditorStrings } from "@/i18n/articles-editor";
import { howToStrings } from "@/i18n/how-to";
import type { Language, Page } from "@/lib/types";
import { pageFromPath, type AppPage } from "@/lib/page-routing";
import { isHashOnlyNavigation } from "@/lib/navigation";

export { pageFromPath } from "@/lib/page-routing";

const Desk = lazy(() => import("@/desk/desk").then((m) => ({ default: m.Desk })));
const DeskLogin = lazy(() => import("@/desk/login").then((m) => ({ default: m.DeskLogin })));
const GetHelp = lazy(() => import("@/pages/get-help").then((m) => ({ default: m.GetHelp })));
const GiveHelp = lazy(() => import("@/pages/give-help").then((m) => ({ default: m.GiveHelp })));
const Ledger = lazy(() => import("@/pages/ledger").then((m) => ({ default: m.Ledger })));
const AuditPage = lazy(() => import("@/pages/audit").then((m) => ({ default: m.AuditPage })));
const FindPerson = lazy(() => import("@/pages/find-person").then((m) => ({ default: m.FindPerson })));
const MissingGuide = lazy(() => import("@/pages/missing-guide").then((m) => ({ default: m.MissingGuide })));
const PosterPage = lazy(() => import("@/pages/poster").then((m) => ({ default: m.PosterPage })));
const PosterCatalogue = lazy(() => import("@/pages/poster").then((m) => ({ default: m.PosterCatalogue })));
const PosterRecordPage = lazy(() => import("@/pages/poster").then((m) => ({ default: m.PosterRecordPage })));
const MePage = lazy(() => import("@/pages/me").then((m) => ({ default: m.MePage })));
const InfoHelp = lazy(() => import("@/pages/info-help").then((m) => ({ default: m.InfoHelp })));
const ProjectsList = lazy(() => import("@/pages/projects").then((m) => ({ default: m.ProjectsList })));
const DispatchesPage = lazy(() => import("@/pages/dispatches").then((m) => ({ default: m.DispatchesPage })));
const DispatchDetail = lazy(() => import("@/pages/dispatch-detail").then((m) => ({ default: m.DispatchDetail })));
const ProjectDetail = lazy(() => import("@/pages/project-detail").then((m) => ({ default: m.ProjectDetail })));
const ProjectRegister = lazy(() => import("@/pages/project-register").then((m) => ({ default: m.ProjectRegister })));
const ProjectUpdate = lazy(() => import("@/pages/project-update").then((m) => ({ default: m.ProjectUpdate })));
const ReportIncident = lazy(() => import("@/pages/report-incident").then((m) => ({ default: m.ReportIncident })));
const PrivacyPolicy = lazy(() => import("@/pages/privacy").then((m) => ({ default: m.PrivacyPolicy })));
const RegisterOrganization = lazy(() => import("@/pages/register-organization").then((m) => ({ default: m.RegisterOrganization })));
const OrgDashboard = lazy(() => import("@/org/org-dashboard").then((m) => ({ default: m.OrgDashboard })));
const DropCenters = lazy(() => import("@/pages/drop-centers").then((m) => ({ default: m.DropCenters })));
const DropCenterDetail = lazy(() => import("@/pages/drop-center-detail").then((m) => ({ default: m.DropCenterDetail })));
const DonationStatusPage = lazy(() => import("@/pages/donation-status").then((m) => ({ default: m.DonationStatusPage })));
const ClimatePage = lazy(() => import("@/pages/climate").then((m) => ({ default: m.ClimatePage })));
const OurMessagePage = lazy(() => import("@/pages/our-message").then((m) => ({ default: m.OurMessagePage })));
const IncidentsPage = lazy(() => import("@/pages/incidents").then((m) => ({ default: m.IncidentsPage })));
const MyArticlesPage = lazy(() => import("@/articles/my-articles").then((m) => ({ default: m.MyArticlesPage })));
const ArticleEditor = lazy(() => import("@/articles/editor").then((m) => ({ default: m.ArticleEditor })));
const HowTo = lazy(() => import("@/pages/how-to").then((m) => ({ default: m.HowTo })));

const pagePaths: Record<AppPage, string> = {
  dashboard: "/",
  search: "/search",
  missing: "/missing",
  poster: "/poster",
  posterNew: "/poster/new",
  posterView: "/poster/:id",
  me: "/me",
  myArticles: "/me/articles",
  articleEdit: "/me/articles/:id/edit",
  info: "/info",
  privacy: "/privacy",
  desk: "/desk",
  deskLogin: "/desk/login",
  getHelp: "/get-help",
  giveHelp: "/give-help",
  ledger: "/ledger",
  audit: "/audit",
  dispatches: "/articles",
  dispatchDetail: "/articles/:id",
  dispatchWrite: "/articles",
  projects: "/projects",
  projectDetail: "/projects/:id",
  projectRegister: "/projects/register",
  projectUpdate: "/projects/update",
  registerOrg: "/register-organization",
  org: "/org",
  dropCenters: "/drop-centers",
  dropCenterDetail: "/drop-centers/:id",
  donationStatus: "/donation/:ref",
  climate: "/climate",
  howTo: "/how-to",
  ourMessage: "/our-message",
  reportIncident: "/report-incident",
  incidents: "/incidents",
  notFound: "/404",
};

/** "/poster/new" → undefined; "/poster/<id>" → id. */
function posterIdFromPath(pathname: string) {
  const id = decodeURIComponent(pathname.split("/")[2] ?? "");
  return id && id !== "new" ? id : undefined;
}

function pageTitle(page: AppPage, language: Language): string {
  const t = labels[language] as Record<string, string>;
  const map: Record<AppPage, string> = {
    dashboard: t.dashboard,
    search: t.search,
    missing: t.missingGuideTitle,
    poster: posterStrings[language].catalogueTitle,
    posterNew: posterStrings[language].title,
    posterView: posterStrings[language].catalogueTitle,
    me: meStrings[language].title,
    myArticles: articlesEditorStrings[language].listTitle,
    articleEdit: articlesEditorStrings[language].title,
    info: t.info,
    privacy: t.privacyTitle,
    desk: t.deskTitle,
    deskLogin: meStrings[language].navSignIn,
    getHelp: t.getHelp,
    giveHelp: t.giveHelp,
    ledger: t.ledgerTitle,
    audit: (t as Record<string, string>).navAuditLabel ?? "Audit",
    dispatches: (t as Record<string, string>).dispatches ?? "Articles",
    dispatchDetail: (t as Record<string, string>).dispatches ?? "Articles",
    dispatchWrite: (t as Record<string, string>).dispatches ?? "Articles",
    projects: (t as Record<string, string>).projects ?? "Projects",
    projectDetail: (t as Record<string, string>).projects ?? "Projects",
    projectRegister: t.projectRegisterTitle,
    projectUpdate: t.projectUpdateTitle,
    registerOrg: orgStrings[language].registerOrgTitle,
    org: orgStrings[language].orgDashboardTitle,
    dropCenters: centerStrings[language].dropCentersTitle,
    dropCenterDetail: centerStrings[language].dropCentersTitle,
    donationStatus: centerStrings[language].donationStatusTitle,
    climate: climateStrings[language].title,
    howTo: howToStrings[language].pageTitle,
    ourMessage: ourMessageStrings[language].title,
    reportIncident: disasterStrings[language].reportIncidentTitle,
    incidents: disasterStrings[language].incidentsPublicTitle,
    notFound: shellStrings[language].notFoundTitle,
  };
  return map[page] ?? t.brand ?? "verifiedNepal";
}

function focusMainAndScroll(sectionId?: string) {
  const main = document.getElementById("main");
  if (main) {
    (main as HTMLElement).focus({ preventScroll: true });
  }
  const hash = window.location.hash.slice(1);
  let hashTargetId = hash;
  if (hash) {
    try {
      hashTargetId = decodeURIComponent(hash);
    } catch {
      hashTargetId = hash;
    }
  }
  const targetId = hash ? hashTargetId : sectionId;
  const target = targetId ? document.getElementById(targetId) : null;
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

export function App() {
  const [language, setLanguage] = useState<Language>(() => {
    const stored = localStorage.getItem("verifiednepal:language");
    return stored === "ne" ? "ne" : "en";
  });
  const [page, setPage] = useState<AppPage>(() => pageFromPath(window.location.pathname + window.location.search));
  const lastNavigationUrl = useRef(window.location.pathname + window.location.search + window.location.hash);

  useEffect(() => {
    localStorage.setItem("verifiednepal:language", language);
    document.documentElement.lang = language === "ne" ? "ne" : "en";
  }, [language]);

  useEffect(() => {
    document.title = `${pageTitle(page, language)} · verifiedNepal`;
    document.documentElement.dataset.page = page;
  }, [page, language]);

  useEffect(() => {
    const onPopState = () => {
      const previousUrl = lastNavigationUrl.current;
      const nextUrl = window.location.pathname + window.location.search + window.location.hash;
      const hashOnlyNavigation = isHashOnlyNavigation(previousUrl, nextUrl);
      lastNavigationUrl.current = nextUrl;
      const next = pageFromPath(window.location.pathname + window.location.search);
      setPage(next);
      requestAnimationFrame(() => {
        document.title = `${pageTitle(next, language)} · verifiedNepal`;
        if (!hashOnlyNavigation) focusMainAndScroll();
      });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [language]);

  useEffect(() => {
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (page === "search") {
      if (!robots) {
        robots = document.createElement("meta");
        robots.name = "robots";
        document.head.appendChild(robots);
      }
      robots.content = "noindex";
    } else if (robots) {
      robots.remove();
    }
  }, [page]);

  const navigate = useCallback(
    (nextPage: Page, sectionId?: string) => {
      window.history.pushState({}, "", pagePaths[nextPage]);
      lastNavigationUrl.current = window.location.pathname + window.location.search + window.location.hash;
      setPage(nextPage);
      document.title = `${pageTitle(nextPage, language)} · verifiedNepal`;
      requestAnimationFrame(() => {
        focusMainAndScroll(sectionId);
      });
    },
    [language],
  );

  const skipLink = (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground"
    >
      Skip to main content
    </a>
  );
  const loading = <p className="min-h-[40vh] p-6 text-sm text-muted-foreground">{shellStrings[language].loading}</p>;

  // Signed-in work surfaces bring their own shell (AppShell); public pages share the site header and footer.
  if (page === "desk" || page === "deskLogin" || page === "org") {
    return (
      <LiveDataProvider>
        {skipLink}
        <Suspense fallback={loading}>
          <ComponentErrorBoundary language={language}>
            {page === "desk" ? (
              <Desk language={language} setLanguage={setLanguage} navigate={navigate} />
            ) : page === "deskLogin" ? (
              <DeskLogin language={language} setLanguage={setLanguage} navigate={navigate} />
            ) : (
              <OrgDashboard language={language} setLanguage={setLanguage} navigate={navigate} />
            )}
          </ComponentErrorBoundary>
        </Suspense>
      </LiveDataProvider>
    );
  }

  return (
    <LiveDataProvider>
      <div className="flex min-h-dvh flex-col bg-background text-foreground">
        {skipLink}
        <SiteHeader language={language} setLanguage={setLanguage} navigate={navigate} />
        <SiteStatusBar language={language} navigate={navigate} />
        <EmergencyBar language={language} />
        <main
          id="main"
          tabIndex={-1}
          className={`${page === "dashboard" ? "w-full" : "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"} flex-1 pb-16 pt-8 outline-none`}
        >
          {page === "dashboard" ? (
            <Dashboard language={language} navigate={navigate} />
          ) : (
            <Suspense fallback={loading}>
              {page === "search" ? <FindPerson language={language} navigate={navigate} /> : null}
              {page === "missing" ? <MissingGuide language={language} navigate={navigate} /> : null}
              {page === "poster" ? (
                <ComponentErrorBoundary language={language}>
                  <PosterCatalogue language={language} navigate={navigate} />
                </ComponentErrorBoundary>
              ) : null}
              {page === "posterNew" ? (
                <ComponentErrorBoundary language={language}>
                  <PosterPage language={language} navigate={navigate} savedId={posterIdFromPath(window.location.pathname)} />
                </ComponentErrorBoundary>
              ) : null}
              {page === "posterView" ? (
                <ComponentErrorBoundary language={language}>
                  <PosterRecordPage language={language} navigate={navigate} id={posterIdFromPath(window.location.pathname) ?? ""} />
                </ComponentErrorBoundary>
              ) : null}
              {page === "me" ? (
                <ComponentErrorBoundary language={language}>
                  <MePage language={language} navigate={navigate} />
                </ComponentErrorBoundary>
              ) : null}
              {page === "myArticles" ? (
                <ComponentErrorBoundary language={language}>
                  <MyArticlesPage language={language} />
                </ComponentErrorBoundary>
              ) : null}
              {page === "articleEdit" ? (
                <ComponentErrorBoundary language={language}>
                  <ArticleEditor language={language} id={decodeURIComponent(window.location.pathname.split("/")[3] || "")} />
                </ComponentErrorBoundary>
              ) : null}
              {page === "info" ? <InfoHelp language={language} /> : null}
              {page === "privacy" ? <PrivacyPolicy language={language} /> : null}
              {page === "getHelp" ? (
                <ComponentErrorBoundary language={language}>
                  <GetHelp language={language} />
                </ComponentErrorBoundary>
              ) : null}
              {page === "giveHelp" ? (
                <ComponentErrorBoundary language={language}>
                  <GiveHelp language={language} />
                </ComponentErrorBoundary>
              ) : null}
              {page === "ledger" ? (
                <ComponentErrorBoundary language={language}>
                  <Ledger language={language} />
                </ComponentErrorBoundary>
              ) : null}
              {page === "audit" ? (
                <ComponentErrorBoundary language={language}>
                  <AuditPage language={language} />
                </ComponentErrorBoundary>
              ) : null}
              {page === "projects" ? (
                <ComponentErrorBoundary language={language}>
                  <ProjectsList language={language} />
                </ComponentErrorBoundary>
              ) : null}
              {page === "projectRegister" ? (
                <ComponentErrorBoundary language={language}>
                  <ProjectRegister language={language} />
                </ComponentErrorBoundary>
              ) : null}
              {page === "projectUpdate" ? (
                <ComponentErrorBoundary language={language}>
                  <ProjectUpdate language={language} />
                </ComponentErrorBoundary>
              ) : null}
              {page === "dispatches" ? (
                <ComponentErrorBoundary language={language}>
                  <DispatchesPage language={language} />
                </ComponentErrorBoundary>
              ) : null}
              {page === "dispatchDetail" ? (
                <ComponentErrorBoundary language={language}>
                  <DispatchDetail language={language} id={decodeURIComponent(window.location.pathname.split("/")[2] || "")} />
                </ComponentErrorBoundary>
              ) : null}
              {page === "projectDetail" ? (
                <ComponentErrorBoundary language={language}>
                  <ProjectDetail language={language} id={decodeURIComponent(window.location.pathname.split("/")[2] || "")} />
                </ComponentErrorBoundary>
              ) : null}
              {page === "registerOrg" ? (
                <ComponentErrorBoundary language={language}>
                  <RegisterOrganization language={language} navigate={navigate} />
                </ComponentErrorBoundary>
              ) : null}
              {page === "dropCenters" ? (
                <ComponentErrorBoundary language={language}>
                  <DropCenters language={language} navigate={navigate} />
                </ComponentErrorBoundary>
              ) : null}
              {page === "dropCenterDetail" ? (
                <ComponentErrorBoundary language={language}>
                  <DropCenterDetail
                    language={language}
                    navigate={navigate}
                    id={decodeURIComponent(window.location.pathname.split("/")[2] || "")}
                  />
                </ComponentErrorBoundary>
              ) : null}
              {page === "climate" ? (
                <ComponentErrorBoundary language={language}>
                  <ClimatePage language={language} navigate={navigate} />
                </ComponentErrorBoundary>
              ) : null}
              {page === "howTo" ? <HowTo language={language} /> : null}
              {page === "ourMessage" ? (
                <ComponentErrorBoundary language={language}>
                  <OurMessagePage language={language} />
                </ComponentErrorBoundary>
              ) : null}
              {page === "reportIncident" ? (
                <ComponentErrorBoundary language={language}>
                  <ReportIncident language={language} />
                </ComponentErrorBoundary>
              ) : null}
              {page === "incidents" ? (
                <ComponentErrorBoundary language={language}>
                  <IncidentsPage language={language} />
                </ComponentErrorBoundary>
              ) : null}
              {page === "notFound" ? <NotFound language={language} onBack={() => navigate("dashboard")} /> : null}
              {page === "donationStatus" ? (
                <ComponentErrorBoundary language={language}>
                  <DonationStatusPage
                    language={language}
                    navigate={navigate}
                    refCode={decodeURIComponent(window.location.pathname.split("/")[2] || "")}
                  />
                </ComponentErrorBoundary>
              ) : null}
            </Suspense>
          )}
        </main>
        <SiteFooter language={language} navigate={navigate} />
        <BackToTop language={language} />
      </div>
    </LiveDataProvider>
  );
}
