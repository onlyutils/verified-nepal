import { ShieldCheck } from "lucide-react";
import { meStrings } from "@/i18n/me";
import type { Language, Page } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { LiveStatusBadge } from "@/lib/live";
import { rememberReturnTo, useGoogleAuth } from "@/lib/auth";
import { OutboxBadge } from "@/components/outbox-badge";

const container = "mx-auto flex min-h-9 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8";

export function SiteStatusBar({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  // Signed-in people reach the Desk from My account; the bar link is the site's single sign-in entry.
  const signedIn = Boolean(useGoogleAuth().idToken);

  return (
    <div className="site-status-bar border-b border-primary-soft-border bg-primary-soft">
      <div className={container}>
        <LiveStatusBadge language={language} />
        <OutboxBadge language={language} />
        {signedIn ? null : (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto min-h-11 px-0 hidden lg:inline-flex"
            onClick={() => {
              rememberReturnTo();
              navigate("deskLogin");
            }}
          >
            <ShieldCheck aria-hidden="true" />
            {meStrings[language].navSignIn}
          </Button>
        )}
      </div>
    </div>
  );
}
