import { data } from "@/lib/data";
import { EmergencyContacts, PublicNotice } from "@/pages/home";
import { labels } from "@/i18n";
import type { Language } from "@/lib/types";
import { Headline, Rule, SectionLabel } from "@/components/legacy";
import { formatDateTime, officialRescueUrl } from "@/lib/format";

export function InfoHelp({ language }: { language: Language }) {
  const t = labels[language];

  return (
    <div className="mx-auto max-w-[52rem] space-y-10">
      <Headline level={2} as="h1">
        {t.info}
      </Headline>
      <EmergencyContacts language={language} />
      <PublicNotice language={language} />
      <Rule />
      <TextColumn title={t.aboutTitle}>{t.aboutBody}</TextColumn>
      <TextColumn title={t.dataSourceTitle}>
        {t.dataSourceBody}
        <span className="mt-3 block font-sans text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground">
          {t.lastSynced}: {formatDateTime(data.meta.synced_at, language)}
        </span>
      </TextColumn>
      <Rule />
      <div className="grid gap-10 sm:grid-cols-2">
        <LinkList
          title={t.contactsTitle}
          links={[
            [t.ndrrma, "https://ndrrma.gov.np"],
            [t.moha, "https://moha.gov.np"],
            [t.officialRescue, officialRescueUrl],
          ]}
        />
        <LinkList
          title={t.respondersTitle}
          intro={t.respondersBody}
          links={[
            ["Direct Relief", "https://www.directrelief.org/emergency/nepal/"],
            ["Oxfam", "https://www.oxfam.org/en/nepal"],
            ["CARE", "https://www.care.org/our-work/where-we-work/nepal/"],
            ["UNICEF", "https://www.unicef.org/nepal/"],
          ]}
        />
      </div>
    </div>
  );
}

function TextColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <Headline level={3} as="h2">
        {title}
      </Headline>
      <p className="mt-3 max-w-[40rem] font-serif leading-7 text-ink">{children}</p>
    </section>
  );
}

function LinkList({ title, intro, links }: { title: string; intro?: string; links: Array<[string, string]> }) {
  return (
    <section>
      <SectionLabel>{title}</SectionLabel>
      {intro ? <p className="mt-3 font-serif text-sm italic text-muted-foreground">{intro}</p> : null}
      <ul className="mt-1 divide-y divide-rule">
        {links.map(([label, href]) => (
          <li key={href}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 items-center justify-between gap-3 font-serif text-blue hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red"
            >
              {label}
              <span aria-hidden="true">↗</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
