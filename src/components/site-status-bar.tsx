import { ShieldCheck } from "lucide-react";
import { labels } from "@/i18n";
import { centerStrings } from "@/i18n/centers";
import { climateStrings } from "@/i18n/climate";
import { shellStrings } from "@/i18n/shell";
import { posterStrings } from "@/i18n/poster";
import type { Language, Page } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { LiveStatusBadge } from "@/lib/live";
import { useGoogleAuth } from "@/lib/auth";

const container = "mx-auto flex min-h-9 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8";

export function SiteStatusBar({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  const t = labels[language] as Record<string, string>;
  const ts = shellStrings[language];
  // Signed-in people reach the Desk from My account; the bar link is for the signed-out entry.
  const signedIn = Boolean(useGoogleAuth().idToken);
  const links: Array<[Page, string]> = [
    ["dashboard", t.dashboard],
    ["poster", posterStrings[language].title],
    ["dropCenters", centerStrings[language].navDropCenters],
    ["climate", climateStrings[language].navLabel],
    ["projects", t.projects],
    ["dispatches", t.dispatches],
    ["ledger", t.ledgerTitle],
  ];

  return (
    <div className="border-b border-primary-soft-border bg-primary-soft">
      <div className={container}>
        <LiveStatusBadge language={language} />
        <nav aria-label={ts.primaryNavigation} className="hidden items-center gap-3 lg:flex">
          {links.map(([page, label]) => (
            <Button key={page} type="button" variant="link" size="sm" className="h-auto min-h-11 px-0" onClick={() => navigate(page)}>
              {label} →
            </Button>
          ))}
          {signedIn ? null : (
            <>
              <span aria-hidden="true" className="h-4 w-px bg-primary-soft-border" />
              <Button type="button" variant="link" size="sm" className="h-auto min-h-11 px-0" onClick={() => navigate("desk")}>
                <ShieldCheck aria-hidden="true" />
                {t.deskTitle}
              </Button>
            </>
          )}
        </nav>
      </div>
    </div>
  );
}
