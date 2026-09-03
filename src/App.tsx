import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Dashboard } from "@/pages/home";
import { ComponentErrorBoundary } from "@/components/error-boundary";
import { BackToTop } from "@/components/back-to-top";
import { EmergencyBar } from "@/components/emergency-bar";
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
import { articlesEditorStrings } from "@/i18n/articles-editor";
import type { Language, Page } from "@/lib/types";

type ArticlePage = "myArticles" | "articleEdit";
type AppPage = Page | ArticlePage;

const Desk = lazy(() => import("@/desk/desk").then((m) => ({ default: m.Desk })));
const DeskLogin = lazy(() => import("@/desk/login").then((m) => ({ default: m.DeskLogin })));
const GetHelp = lazy(() => import("@/pages/get-help").then((m) => ({ default: m.GetHelp })));
const GiveHelp = lazy(() => import("@/pages/give-help").then((m) => ({ default: m.GiveHelp })));
const Ledger = lazy(() => import("@/pages/ledger").then((m) => ({ default: m.Ledger })));
const AuditPage = lazy(() => import("@/pages/audit").then((m) => ({ default: m.AuditPage })));
const FindPerson = lazy(() => import("@/pages/find-person").then((m) => ({ default: m.FindPerson })));
const MissingGuide = lazy(() => import("@/pages/missing-guide").then((m) => ({ default: m.MissingGuide })));
const PosterPage = lazy(() => import("@/pages/poster").then((m) => ({ default: m.PosterPage })));
const MePage = lazy(() => import("@/pages/me").then((m) => ({ default: m.MePage })));
const InfoHelp = lazy(() => import("@/pages/info-help").then((m) => ({ default: m.InfoHelp })));
const ProjectsList = lazy(() => import("@/pages/projects").then((m) => ({ default: m.ProjectsList })));
const DispatchesPage = lazy(() => import("@/pages/dispatches").then((m) => ({ default: m.DispatchesPage })));
const DispatchDetail = lazy(() => import("@/pages/dispatch-detail").then((m) => ({ default: m.DispatchDetail })));
const ProjectDetail = lazy(() => import("@/pages/project-detail").then((m) => ({ default: m.ProjectDetail })));
const ProjectRegister = lazy(() => import("@/pages/project-register").then((m) => ({ default: m.ProjectRegister })));
const ProjectUpdate = lazy(() => import("@/pages/project-update").then((m) => ({ default: m.ProjectUpdate })));
const PrivacyPolicy = lazy(() => import("@/pages/privacy").then((m) => ({ default: m.PrivacyPolicy })));
const RegisterOrganization = lazy(() => import("@/pages/register-organization").then((m) => ({ default: m.RegisterOrganization })));
const OrgDashboard = lazy(() => import("@/org/org-dashboard").then((m) => ({ default: m.OrgDashboard })));
const DropCenters = lazy(() => import("@/pages/drop-centers").then((m) => ({ default: m.DropCenters })));
const DropCenterDetail = lazy(() => import("@/pages/drop-center-detail").then((m) => ({ default: m.DropCenterDetail })));
const DonationStatusPage = lazy(() => import("@/pages/donation-status").then((m) => ({ default: m.DonationStatusPage })));
const ClimatePage = lazy(() => import("@/pages/climate").then((m) => ({ default: m.ClimatePage })));
const MyArticlesPage = lazy(() => import("@/articles/my-articles").then((m) => ({ default: m.MyArticlesPage })));
const ArticleEditor = lazy(() => import("@/articles/editor").then((m) => ({ default: m.ArticleEditor })));

const pagePaths: Record<AppPage, string> = {
  dashboard: "/",
  search: "/search",
  missing: "/missing",
  poster: "/poster",
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
};

function pageFromPath(pathname: string): AppPage {
  if (pathname.match(/^\/donation\/[^\/]+/)) return "donationStatus";
  if (pathname.startsWith("/register-organization")) return "registerOrg";
  if (pathname.startsWith("/org")) return "org";
  if (pathname.match(/^\/drop-centers\/[^\/]+/)) return "dropCenterDetail";
  if (pathname.startsWith("/drop-centers")) return "dropCenters";
  if (pathname.startsWith("/climate")) return "climate";
  if (pathname.match(/^\/articles\/[^\/]+/)) return "dispatchDetail";
  if (pathname.startsWith("/articles")) return "dispatches";
  if (pathname.match(/^\/me\/articles\/[^\/]+\/edit/)) return "articleEdit";
  if (pathname.startsWith("/me/articles")) return "myArticles";
  if (pathname.startsWith("/projects/register")) return "projectRegister";
  if (pathname.startsWith("/projects/update")) return "projectUpdate";
  if (pathname.match(/^\/projects\/[^\/]+/)) return "projectDetail";
  if (pathname.startsWith("/projects")) return "projects";
  if (pathname.startsWith("/get-help")) return "getHelp";
  if (pathname.startsWith("/give-help")) return "giveHelp";
  if (pathname.startsWith("/audit")) return "audit";
  if (pathname.startsWith("/ledger")) return "ledger";
  if (pathname.startsWith("/desk/login")) return "deskLogin";
  if (pathname.startsWith("/desk")) return "desk";
  if (pathname.startsWith("/search")) return "search";
  if (pathname === "/me" || pathname.startsWith("/me/")) return "me";
  if (pathname.startsWith("/missing")) return "missing";
  if (pathname.startsWith("/poster")) return "poster";
  if (pathname.startsWith("/info")) return "info";
  if (pathname.startsWith("/privacy")) return "privacy";
  return "dashboard";
}

function pageTitle(page: AppPage, language: Language): string {
  const t = labels[language] as Record<string, string>;
  const map: Record<AppPage, string> = {
    dashboard: t.dashboard,
    search: t.search,
    missing: t.missingGuideTitle,
    poster: posterStrings[language].title,
    me: meStrings[language].title,
    myArticles: articlesEditorStrings[language].listTitle,
    articleEdit: articlesEditorStrings[language].title,
    info: t.info,
    privacy: t.privacyTitle,
    desk: t.deskTitle,
    deskLogin: t.deskTitle,
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
  };
  return map[page] ?? t.brand ?? "verifiedNepal";
}

function focusMainAndScroll() {
  const main = document.getElementById("main");
  if (main) {
    (main as HTMLElement).focus({ preventScroll: true });
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function App() {
  const [language, setLanguage] = useState<Language>(() => {
    const stored = localStorage.getItem("verifiednepal:language");
    return stored === "ne" ? "ne" : "en";
  });
  const [page, setPage] = useState<AppPage>(() => pageFromPath(window.location.pathname));

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
      const next = pageFromPath(window.location.pathname);
      setPage(next);
      requestAnimationFrame(() => {
        document.title = `${pageTitle(next, language)} · verifiedNepal`;
        focusMainAndScroll();
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
    (nextPage: Page) => {
      window.history.pushState({}, "", pagePaths[nextPage]);
      setPage(nextPage);
      document.title = `${pageTitle(nextPage, language)} · verifiedNepal`;
      requestAnimationFrame(() => {
        focusMainAndScroll();
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
                  <PosterPage
                    language={language}
                    navigate={navigate}
                    savedId={new URLSearchParams(window.location.search).get("id") || undefined}
                  />
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
                  <ClimatePage language={language} />
                </ComponentErrorBoundary>
              ) : null}
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
