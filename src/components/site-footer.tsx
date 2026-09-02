import { labels } from "@/i18n";
import { orgStrings } from "@/i18n/orgs";
import { shellStrings } from "@/i18n/shell";
import { githubUrl, onlyUtilsUrl, pmdrfUrl, pmoAppealUrl } from "@/lib/urls";
import type { Language, Page } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/page-header";
import { Logo } from "@/components/logo";
import { LiveStatusBadge } from "@/lib/live";
import { guideLinks } from "@/components/site-header";

const container = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";
const linkClass =
  "inline-flex min-h-11 items-center text-sm text-faint underline-offset-4 hover:text-background hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-foreground";

export function SiteFooter({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  const t = labels[language];
  const ts = shellStrings[language];
  const routeLink = (page: Page, label: string) => (
    <Button type="button" variant="link" className={`h-auto min-h-11 justify-start p-0 ${linkClass}`} onClick={() => navigate(page)}>
      {label}
    </Button>
  );

  return (
    <footer className="bg-foreground text-background">
      <div className={`${container} py-12 lg:py-16`}>
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div>
            <Logo language={language} variant="light" />
            <p className="mt-5 max-w-sm text-sm leading-6 text-faint">{t.aboutBody}</p>
          </div>
          <FooterColumn title={ts.footerOfficialLinks}>
            <a className={linkClass} href="https://ndrrma.gov.np" target="_blank" rel="noopener noreferrer">
              {ts.footerNdrRma} ↗
            </a>
            <a className={linkClass} href={pmdrfUrl} target="_blank" rel="noopener noreferrer">
              {ts.footerPmdrf} ↗
            </a>
            <a className={linkClass} href={githubUrl} target="_blank" rel="noopener noreferrer">
              {t.contributeLink} ↗
            </a>
          </FooterColumn>
          <FooterColumn title={ts.footerAccountability}>
            {routeLink("ledger", ts.footerPublicLedger)}
            {routeLink("audit", t.footerAuditLink)}
            {routeLink("privacy", ts.footerPrivacy)}
          </FooterColumn>
          <FooterColumn title={ts.footerAbout}>
            {routeLink("info", ts.footerDataSources)}
            <a className={linkClass} href={githubUrl} target="_blank" rel="noopener noreferrer">
              {ts.githubLink}
            </a>
            <a className={linkClass} href="mailto:verifiednepal01@gmail.com">
              {ts.footerContact}
            </a>
            {routeLink("privacy", ts.footerIndependentStatus)}
            {routeLink("org", orgStrings[language].navMyOrg)}
            {routeLink("desk", ts.footerTheDesk)}
          </FooterColumn>
          <FooterColumn title={ts.footerGuides}>
            {guideLinks(language).map(([href, label]) => (
              <a key={href} className={linkClass} href={href} target="_blank" rel="noopener noreferrer">
                {label}
              </a>
            ))}
          </FooterColumn>
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-faint/20 pt-5 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
          <LiveStatusBadge language={language} tone="faint" />
          <p>
            {ts.footerPoweredBy}{" "}
            <a className="underline underline-offset-2 hover:text-background" href={onlyUtilsUrl} target="_blank" rel="noopener noreferrer">
              {ts.onlyUtils}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <Eyebrow tone="muted" className="text-faint">
        {title}
      </Eyebrow>
      {children}
    </div>
  );
}
