import { useState } from "react";
import { Menu, UserRound } from "lucide-react";
import { useGoogleAuth } from "@/lib/auth";
import { labels } from "@/i18n";
import { centerStrings } from "@/i18n/centers";
import { meStrings } from "@/i18n/me";
import { orgStrings } from "@/i18n/orgs";
import { posterStrings } from "@/i18n/poster";
import { shellStrings } from "@/i18n/shell";
import type { Language, Page } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { AccessibilityBar } from "@/components/accessibility-bar";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const container = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";
const navPages = [
  ["search", "search"],
  ["poster", "poster"],
  ["getHelp", "getHelp"],
  ["giveHelp", "giveHelp"],
  ["dropCenters", "dropCenters"],
  ["info", "info"],
  ["projects", "projects"],
  ["dispatches", "dispatches"],
  ["ledger", "ledgerTitle"],
  ["audit", "navAuditLabel"],
] as const;

export function SiteHeader({
  language,
  setLanguage,
  navigate,
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  navigate: (page: Page) => void;
}) {
  const t = labels[language];
  const ts = shellStrings[language];
  const [menuOpen, setMenuOpen] = useState(false);
  const signedIn = Boolean(useGoogleAuth().idToken);
  const otherLanguage = language === "en" ? "नेपाली" : "EN";

  return (
    <header className="border-b bg-background">
      <div className={`${container} flex h-14 items-center justify-between gap-2`}>
        <button
          type="button"
          onClick={() => navigate("dashboard")}
          aria-label={t.dashboard}
          className="min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Logo language={language} tagline={ts.tagline} className="min-w-0" />
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <AccountButton language={language} navigate={navigate} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 h-auto"
            onClick={() => setLanguage(language === "en" ? "ne" : "en")}
            aria-label={`${t.language}: ${otherLanguage}`}
          >
            <span lang={language === "en" ? "ne" : "en"}>{otherLanguage}</span>
          </Button>
          <AccessibilityBar language={language} />
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="lg:hidden" aria-label={ts.menu}>
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(22rem,calc(100vw-2rem))] overflow-y-auto">
              <SheetHeader className="text-left">
                <SheetTitle>{ts.menu}</SheetTitle>
                <SheetDescription>{ts.primaryNavigation}</SheetDescription>
              </SheetHeader>
              <nav aria-label={ts.primaryNavigation} className="mt-6 grid gap-1">
                <SheetClose asChild>
                  <Button type="button" variant="ghost" className="justify-start" onClick={() => navigate("dashboard")}>
                    {t.dashboard}
                  </Button>
                </SheetClose>
                {navPages.map(([page, key]) => (
                  <SheetClose key={page} asChild>
                    <Button type="button" variant="ghost" className="justify-start" onClick={() => navigate(page as Page)}>
                      {navigationLabel(page, key, language)}
                    </Button>
                  </SheetClose>
                ))}
                <div className="my-3 border-t" />
                {signedIn ? null : (
                  <SheetClose asChild>
                    <Button type="button" variant="ghost" className="justify-start" onClick={() => navigate("desk")}>
                      {t.deskTitle}
                    </Button>
                  </SheetClose>
                )}
                <SheetClose asChild>
                  <Button type="button" variant="ghost" className="justify-start" onClick={() => navigate("org")}>
                    {orgStrings[language].navMyOrg}
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button type="button" variant="ghost" className="justify-start" onClick={() => navigate("registerOrg")}>
                    {orgStrings[language].registerOrgCta}
                  </Button>
                </SheetClose>
                <p className="mt-5 px-3 text-xs font-semibold text-muted-foreground">{ts.guidesTitle}</p>
                {guideLinks(language).map(([href, label]) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {label}
                  </a>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function navigationLabel(page: string, key: string, language: Language) {
  const t = labels[language] as Record<string, string>;
  if (page === "dropCenters") return centerStrings[language].navDropCenters;
  if (page === "poster") return posterStrings[language].title;
  return t[key] ?? page;
}

function guideLinks(language: Language) {
  const t = shellStrings[language];
  return [
    ["/guides/VerifiedNepal-Seeking-Help-Guide.pdf", t.guideSeekingHelp],
    ["/guides/VerifiedNepal-Providing-Help-Guide.pdf", t.guideProvidingHelp],
    ["/guides/VerifiedNepal-Organization-Guide.pdf", t.guideOrganization],
    ["/guides/VerifiedNepal-Writing-a-Dispatch-Guide.pdf", t.guideDispatch],
    ["/guides/VerifiedNepal-Moderator-Guide.pdf", t.guideModerator],
  ] as const;
}

export { guideLinks };

function AccountButton({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  const auth = useGoogleAuth();
  const t = meStrings[language];
  if (!auth.clientId) return null;
  return (
    <Button
      type="button"
      variant={auth.idToken ? "ghost" : "outline"}
      size="sm"
      className="min-h-11 h-auto"
      aria-label={auth.idToken ? t.navAccount : t.navSignIn}
      onClick={() => (auth.idToken ? navigate("me") : void auth.signIn())}
    >
      <UserRound aria-hidden="true" />
      <span className="hidden sm:inline">{auth.idToken ? t.navAccount : t.navSignIn}</span>
    </Button>
  );
}
