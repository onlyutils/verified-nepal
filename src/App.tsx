import { useCallback, useEffect, useState } from "react";
import { Dashboard } from "./dashboard";
import { FindPerson } from "./find-person";
import { InfoHelp } from "./info-help";
import { EmergencyStrip, Footer, Header } from "./layout";
import { LiveDataProvider } from "./live";
import { PrivacyPolicy } from "./privacy";
import type { Language, Page } from "./types";

const pagePaths: Record<Page, string> = {
  dashboard: "/",
  search: "/search",
  info: "/info",
  privacy: "/privacy",
};

function pageFromPath(pathname: string): Page {
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
      <div className="min-h-dvh bg-nepal-mist text-nepal-ink">
        <div className="h-1 bg-flag" aria-hidden="true" />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-nepal-blue focus:px-4 focus:py-3 focus:text-white"
        >
          Skip to main content
        </a>
        {page === "dashboard" ? <EmergencyStrip language={language} /> : null}
        <Header page={page} language={language} setLanguage={setLanguage} navigate={navigate} />
        <main id="main" className="mx-auto w-full max-w-[78rem] px-4 pb-20 pt-8 sm:px-6 lg:px-8">
          {page === "dashboard" ? <Dashboard language={language} /> : null}
          {page === "search" ? <FindPerson language={language} /> : null}
          {page === "info" ? <InfoHelp language={language} /> : null}
          {page === "privacy" ? <PrivacyPolicy language={language} /> : null}
        </main>
        <Footer language={language} navigate={navigate} />
      </div>
    </LiveDataProvider>
  );
}
