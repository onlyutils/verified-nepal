import { useCallback, useEffect, useState } from "react";
import { Dashboard } from "./dashboard";
import { Desk } from "./desk";
import { GetHelp } from "./pages/get-help";
import { GiveHelp } from "./pages/give-help";
import { Ledger } from "./pages/ledger";
import { AuditPage } from "./pages/audit";
import { FindPerson } from "./find-person";
import { InfoHelp } from "./info-help";
import { ProjectsList } from "./pages/projects";
import { DispatchesPage } from "./pages/dispatches";
import { DispatchDetail } from "./pages/dispatch-detail";
import { ProjectDetail } from "./pages/project-detail";
import { ProjectRegister } from "./pages/project-register";
import { ProjectUpdate } from "./pages/project-update";
import { AccessibilityBar, BackToTop, EmergencyLine, Footer, Masthead } from "./layout";
import { LiveDataProvider } from "./live";
import { PrivacyPolicy } from "./privacy";
import type { Language, Page } from "./types";

const pagePaths: Record<Page, string> = {
  dashboard: "/",
  search: "/search",
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
  if (pathname.startsWith("/info")) return "info";
  if (pathname.startsWith("/privacy")) return "privacy";
  return "dashboard";
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
    const onPopState = () => setPage(pageFromPath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <LiveDataProvider>
      <div className="min-h-dvh bg-paper font-serif text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-3 focus:text-paper"
        >
          Skip to main content
        </a>
        <AccessibilityBar language={language} />
        <Masthead page={page} language={language} setLanguage={setLanguage} navigate={navigate} />
        <EmergencyLine language={language} />
        <main id="main" className="mx-auto w-full max-w-[80rem] px-4 pb-16 pt-8 sm:px-6 lg:px-8">
          {page === "dashboard" ? <Dashboard language={language} navigate={navigate} /> : null}
          {page === "search" ? <FindPerson language={language} /> : null}
          {page === "info" ? <InfoHelp language={language} /> : null}
          {page === "privacy" ? <PrivacyPolicy language={language} /> : null}
          {page === "desk" ? <Desk language={language} /> : null}
          {page === "getHelp" ? <GetHelp language={language} /> : null}
          {page === "giveHelp" ? <GiveHelp language={language} /> : null}
          {page === "ledger" ? <Ledger language={language} /> : null}
          {page === "audit" ? <AuditPage language={language} /> : null}
          {page === "projects" ? <ProjectsList language={language} /> : null}
          {page === "projectRegister" ? <ProjectRegister language={language} /> : null}
          {page === "projectUpdate" ? <ProjectUpdate language={language} /> : null}
          {page === "dispatches" ? <DispatchesPage language={language} /> : null}
          {page === "dispatchDetail" ? <DispatchDetail language={language} id={decodeURIComponent(window.location.pathname.split("/")[2] || "")} /> : null}
          {page === "projectDetail" ? <ProjectDetail language={language} id={decodeURIComponent(window.location.pathname.split("/")[2] || "")} /> : null}
        </main>
        <Footer language={language} navigate={navigate} />
        <BackToTop language={language} />
      </div>
    </LiveDataProvider>
  );
}
