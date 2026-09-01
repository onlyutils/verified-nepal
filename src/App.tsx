import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Dashboard } from "./dashboard";
import { ComponentErrorBoundary } from "./error-boundary";
import { AccessibilityBar, BackToTop, EmergencyLine, Footer, Masthead } from "./layout";
import { LiveDataProvider } from "./live";
import { labels } from "./i18n";
import { shellStrings } from "./i18n-shell";
import type { Language, Page } from "./types";

const Desk = lazy(() => import("./desk").then((m) => ({ default: m.Desk })));
const GetHelp = lazy(() => import("./pages/get-help").then((m) => ({ default: m.GetHelp })));
const GiveHelp = lazy(() => import("./pages/give-help").then((m) => ({ default: m.GiveHelp })));
const Ledger = lazy(() => import("./pages/ledger").then((m) => ({ default: m.Ledger })));
const AuditPage = lazy(() => import("./pages/audit").then((m) => ({ default: m.AuditPage })));
const FindPerson = lazy(() => import("./find-person").then((m) => ({ default: m.FindPerson })));
const MissingGuide = lazy(() => import("./missing-guide").then((m) => ({ default: m.MissingGuide })));
const InfoHelp = lazy(() => import("./info-help").then((m) => ({ default: m.InfoHelp })));
const ProjectsList = lazy(() => import("./pages/projects").then((m) => ({ default: m.ProjectsList })));
const DispatchesPage = lazy(() => import("./pages/dispatches").then((m) => ({ default: m.DispatchesPage })));
const DispatchDetail = lazy(() => import("./pages/dispatch-detail").then((m) => ({ default: m.DispatchDetail })));
const ProjectDetail = lazy(() => import("./pages/project-detail").then((m) => ({ default: m.ProjectDetail })));
const ProjectRegister = lazy(() => import("./pages/project-register").then((m) => ({ default: m.ProjectRegister })));
const ProjectUpdate = lazy(() => import("./pages/project-update").then((m) => ({ default: m.ProjectUpdate })));
const PrivacyPolicy = lazy(() => import("./privacy").then((m) => ({ default: m.PrivacyPolicy })));

const pagePaths: Record<Page, string> = {
  dashboard: "/",
  search: "/search",
  missing: "/missing",
  info: "/info",
  privacy: "/privacy",
  desk: "/desk",
  getHelp: "/get-help",
  giveHelp: "/give-help",
  ledger: "/ledger",
  audit: "/audit",
  dispatches: "/dispatches",
  dispatchDetail: "/dispatches/:id",
  dispatchWrite: "/dispatches",
  projects: "/projects",
  projectDetail: "/projects/:id",
  projectRegister: "/projects/register",
  projectUpdate: "/projects/update",
};

function pageFromPath(pathname: string): Page {
  if (pathname.match(/^\/dispatches\/[^\/]+/)) return "dispatchDetail";
  if (pathname.startsWith("/dispatches")) return "dispatches";
  if (pathname.startsWith("/projects/register")) return "projectRegister";
  if (pathname.startsWith("/projects/update")) return "projectUpdate";
  if (pathname.match(/^\/projects\/[^\/]+/)) return "projectDetail";
  if (pathname.startsWith("/projects")) return "projects";
  if (pathname.startsWith("/get-help")) return "getHelp";
  if (pathname.startsWith("/give-help")) return "giveHelp";
  if (pathname.startsWith("/audit")) return "audit";
  if (pathname.startsWith("/ledger")) return "ledger";
  if (pathname.startsWith("/desk")) return "desk";
  if (pathname.startsWith("/search")) return "search";
  if (pathname.startsWith("/missing")) return "missing";
  if (pathname.startsWith("/info")) return "info";
  if (pathname.startsWith("/privacy")) return "privacy";
  return "dashboard";
}

function pageTitle(page: Page, language: Language): string {
  const t = labels[language] as Record<string, string>;
  const map: Record<Page, string> = {
    dashboard: t.dashboard,
    search: t.search,
    missing: t.missingGuideTitle,
    info: t.info,
    privacy: t.privacyTitle,
    desk: t.deskTitle,
    getHelp: t.getHelp,
    giveHelp: t.giveHelp,
    ledger: t.ledgerTitle,
    audit: (t as Record<string, string>).navAuditLabel ?? "Audit",
    dispatches: (t as Record<string, string>).dispatches ?? "Dispatches",
    dispatchDetail: (t as Record<string, string>).dispatches ?? "Dispatches",
    dispatchWrite: (t as Record<string, string>).dispatches ?? "Dispatches",
    projects: (t as Record<string, string>).projects ?? "Projects",
    projectDetail: (t as Record<string, string>).projects ?? "Projects",
    projectRegister: t.projectRegisterTitle,
    projectUpdate: t.projectUpdateTitle,
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
  const [page, setPage] = useState<Page>(() => pageFromPath(window.location.pathname));

  useEffect(() => {
    localStorage.setItem("verifiednepal:language", language);
    document.documentElement.lang = language === "ne" ? "ne" : "en";
  }, [language]);

  useEffect(() => {
    document.title = `${pageTitle(page, language)} · verifiedNepal`;
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

  const navigate = useCallback((nextPage: Page) => {
    window.history.pushState({}, "", pagePaths[nextPage]);
    setPage(nextPage);
    document.title = `${pageTitle(nextPage, language)} · verifiedNepal`;
    requestAnimationFrame(() => {
      focusMainAndScroll();
    });
  }, [language]);

  return (
    <LiveDataProvider>
      <div className="min-h-dvh bg-paper font-serif text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-3 focus:text-paper"
        >
          Skip to main content
        </a>
        <AccessibilityBar language={language} setLanguage={setLanguage} compact={page === "desk"} />
        <Masthead page={page} language={language} setLanguage={setLanguage} navigate={navigate} compact={page === "desk"} />
        {page === "desk" ? null : <EmergencyLine language={language} />}
        <main
          id="main"
          tabIndex={-1}
          className={`mx-auto w-full max-w-[80rem] px-4 sm:px-6 lg:px-8 outline-none ${page === "desk" ? "pb-8 pt-4" : "pb-16 pt-8"}`}
        >
          {page === "dashboard" ? <Dashboard language={language} navigate={navigate} /> : (
            <Suspense fallback={<p className="min-h-[40vh] font-sans text-sm text-muted">{shellStrings[language].loading}</p>}>
              {page === "search" ? <FindPerson language={language} navigate={navigate} /> : null}
              {page === "missing" ? <MissingGuide language={language} navigate={navigate} /> : null}
              {page === "info" ? <InfoHelp language={language} /> : null}
              {page === "privacy" ? <PrivacyPolicy language={language} /> : null}
              {page === "desk" ? <ComponentErrorBoundary language={language}><Desk language={language} /></ComponentErrorBoundary> : null}
              {page === "getHelp" ? <ComponentErrorBoundary language={language}><GetHelp language={language} /></ComponentErrorBoundary> : null}
              {page === "giveHelp" ? <ComponentErrorBoundary language={language}><GiveHelp language={language} /></ComponentErrorBoundary> : null}
              {page === "ledger" ? <ComponentErrorBoundary language={language}><Ledger language={language} /></ComponentErrorBoundary> : null}
              {page === "audit" ? <ComponentErrorBoundary language={language}><AuditPage language={language} /></ComponentErrorBoundary> : null}
              {page === "projects" ? <ComponentErrorBoundary language={language}><ProjectsList language={language} /></ComponentErrorBoundary> : null}
              {page === "projectRegister" ? <ComponentErrorBoundary language={language}><ProjectRegister language={language} /></ComponentErrorBoundary> : null}
              {page === "projectUpdate" ? <ComponentErrorBoundary language={language}><ProjectUpdate language={language} /></ComponentErrorBoundary> : null}
              {page === "dispatches" ? <ComponentErrorBoundary language={language}><DispatchesPage language={language} /></ComponentErrorBoundary> : null}
              {page === "dispatchDetail" ? <ComponentErrorBoundary language={language}><DispatchDetail language={language} id={decodeURIComponent(window.location.pathname.split("/")[2] || "")} /></ComponentErrorBoundary> : null}
              {page === "projectDetail" ? <ComponentErrorBoundary language={language}><ProjectDetail language={language} id={decodeURIComponent(window.location.pathname.split("/")[2] || "")} /></ComponentErrorBoundary> : null}
            </Suspense>
          )}
        </main>
        <Footer language={language} navigate={navigate} />
        <BackToTop language={language} />
      </div>
    </LiveDataProvider>
  );
}
