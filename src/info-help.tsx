import { ArrowUpRight } from "lucide-react";
import { data } from "./data";
import { labels } from "./i18n";
import { formatDateTime, officialRescueUrl } from "./utils";
import { Kicker } from "./ui";
import { DonateCta, EmergencyContacts } from "./dashboard";
import type { Language } from "./types";

export function InfoHelp({ language }: { language: Language }) {
  const t = labels[language];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <EmergencyContacts language={language} />
      <DonateCta language={language} />
      <InfoPanel title={t.aboutTitle}>{t.aboutBody}</InfoPanel>
      <InfoPanel title={t.dataSourceTitle}>
        {t.dataSourceBody}
        <span className="mt-3 block text-sm text-nepal-slate">
          {t.lastSynced}: {formatDateTime(data.meta.synced_at, language)}
        </span>
      </InfoPanel>
      <section className="border border-nepal-line bg-white p-6 shadow-panel sm:p-8">
        <Kicker>{t.contactsTitle}</Kicker>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ExternalCard label={t.ndrrma} href="https://ndrrma.gov.np" />
          <ExternalCard label={t.moha} href="https://moha.gov.np" />
          <ExternalCard label={t.officialRescue} href={officialRescueUrl} />
        </div>
      </section>
      <section className="border border-nepal-line bg-white p-6 shadow-panel sm:p-8">
        <Kicker>{t.respondersTitle}</Kicker>
        <p className="mt-4 leading-7 text-nepal-slate">{t.respondersBody}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ExternalCard label="Direct Relief" href="https://www.directrelief.org/emergency/nepal/" />
          <ExternalCard label="Oxfam" href="https://www.oxfam.org/en/nepal" />
          <ExternalCard label="CARE" href="https://www.care.org/our-work/where-we-work/nepal/" />
          <ExternalCard label="UNICEF" href="https://www.unicef.org/nepal/" />
        </div>
      </section>
    </div>
  );
}

function InfoPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-nepal-line bg-white p-6 shadow-panel sm:p-8">
      <h1 className="text-2xl font-bold tracking-display text-nepal-ink">{title}</h1>
      <p className="mt-3 leading-7 text-nepal-slate">{children}</p>
    </section>
  );
}

function ExternalCard({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex min-h-14 items-center justify-between gap-3 border border-nepal-line bg-nepal-mist px-4 py-3 font-semibold text-nepal-blue transition hover:border-nepal-crimson hover:bg-white hover:text-nepal-crimson focus:outline-none focus-visible:ring-2 focus-visible:ring-nepal-crimson"
    >
      {label}
      <ArrowUpRight size={17} aria-hidden="true" />
    </a>
  );
}
