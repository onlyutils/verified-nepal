import type { Page } from "./types.ts";

export type AppPage = Page | "myArticles" | "articleEdit" | "posterView";

export function pageFromPath(path: string): AppPage {
  const url = new URL(path, "https://verifiednepal.local");
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  if (pathname === "/" || pathname === "/index.html") return "dashboard";
  if (pathname.match(/^\/donation\/[^\/]+/)) return "donationStatus";
  if (pathname.match(/^\/status\/[^\/]+/)) return "getHelp";
  if (pathname.startsWith("/register-organization")) return "registerOrg";
  if (pathname.startsWith("/org")) return "org";
  if (pathname.match(/^\/drop-centers\/[^\/]+/)) return "dropCenterDetail";
  if (pathname.startsWith("/drop-centers")) return "dropCenters";
  if (pathname.startsWith("/climate")) return "climate";
  if (pathname.startsWith("/how-to")) return "howTo";
  if (pathname.startsWith("/our-message")) return "ourMessage";
  if (pathname.startsWith("/report-incident")) return "reportIncident";
  if (pathname.startsWith("/incidents")) return "incidents";
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
  if (pathname.startsWith("/coverage")) return "coverage";
  if (pathname.startsWith("/ledger")) return "ledger";
  if (pathname.startsWith("/desk/login")) return "deskLogin";
  if (pathname === "/desk" || pathname.startsWith("/desk/")) return "desk";
  if (pathname.startsWith("/search")) return "search";
  if (pathname === "/me" || pathname.startsWith("/me/")) return "me";
  if (pathname.startsWith("/missing")) return "missing";
  if (pathname.startsWith("/poster/")) return url.searchParams.get("edit") === "1" ? "posterNew" : "posterView";
  if (pathname.startsWith("/poster")) return "poster";
  if (pathname.startsWith("/info")) return "info";
  if (pathname.startsWith("/privacy")) return "privacy";
  return "notFound";
}
