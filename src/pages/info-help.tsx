import { ExternalLink, Phone } from "lucide-react";
import { data } from "@/lib/data";
import { labels, textForLanguage } from "@/i18n";
import { formStrings } from "@/i18n/forms";
import { useLiveData } from "@/lib/live";
import { formatDateTime, formatNumber, sentenceCase, officialRescueUrl } from "@/lib/format";
import { helplines } from "@/lib/helplines";
import { pmdrfUrl, pmoAppealUrl } from "@/lib/urls";
import type { Language } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";

export function InfoHelp({ language }: { language: Language }) {
  const t = labels[language];
  const ts = formStrings[language];
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader eyebrow={ts.infoEyebrow} title={t.info} description={t.aboutBody} />
      <EmergencyInfo language={language} />
      <PublicNotice language={language} />
      <div className="grid gap-6 lg:grid-cols-2">
        <InfoCard title={t.aboutTitle}>
          <p>{t.aboutBody}</p>
        </InfoCard>
        <Card>
          <CardHeader>
            <CardTitle>{t.dataSourceTitle}</CardTitle>
            <CardDescription>{t.dataSourceBody}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium text-muted-foreground">{ts.infoSource}</TableCell>
                  <TableCell>{t.sourceName}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-muted-foreground">{ts.infoUpdated}</TableCell>
                  <TableCell>{formatDateTime(data.meta.synced_at, language)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <InfoTables language={language} />
      <div className="grid gap-6 lg:grid-cols-2">
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

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-base leading-relaxed text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

function EmergencyInfo({ language }: { language: Language }) {
  const t = labels[language];
  return (
    <Card>
      <CardHeader>
        <SectionHeader title={t.emergencyContactsTitle} />
        <CardDescription>{t.emergencyContactsBody}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {helplines.map((line) => (
          <a
            key={line.key}
            href={`tel:${line.number}`}
            className="flex min-h-11 items-center justify-between gap-3 rounded-lg border p-4 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex min-w-0 items-center gap-3 text-sm font-medium">
              <Phone aria-hidden="true" className="size-5 shrink-0 text-destructive" />
              {language === "ne" ? line.labelNe : line.labelEn}
            </span>
            <span className="shrink-0 font-bold tabular-nums text-destructive">{line.number}</span>
          </a>
        ))}
      </CardContent>
    </Card>
  );
}

function PublicNotice({ language }: { language: Language }) {
  const t = labels[language];
  return (
    <Card>
      <CardContent className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-xs font-semibold text-primary">{t.publicNotice}</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">{t.donateTitle}</h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">{t.donateBody}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild variant="destructive">
              <a href={pmdrfUrl} target="_blank" rel="noopener noreferrer">
                {t.donateCta}
                <ExternalLink aria-hidden="true" />
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={pmoAppealUrl} target="_blank" rel="noopener noreferrer">
                {t.donateVerify}
                <ExternalLink aria-hidden="true" />
              </a>
            </Button>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t.donateWarning}</p>
        </div>
        <figure className="m-0 w-fit text-center">
          <img src="/brand/pmdrf-qr.svg" alt={t.donateScan} className="size-40" width="160" height="160" />
          <figcaption className="mt-2 max-w-40 text-xs leading-relaxed text-muted-foreground">
            {t.donateScan}
            <span className="mt-1 block font-mono">pmdrf.nchl.com.np</span>
          </figcaption>
        </figure>
      </CardContent>
    </Card>
  );
}

function InfoTables({ language }: { language: Language }) {
  const t = labels[language];
  const ts = formStrings[language];
  const { statusCounts } = useLiveData();
  const total = Math.max(statusCounts.total_count, 1);
  const countries = data.countryCounts.map((item) => ({ name: sentenceCase(item.country) || t.unavailable, count: item.count }));
  const maxCountry = Math.max(...countries.map((item) => item.count), 1);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t.statusOfRecords}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.statusOfRecords}</TableHead>
                <TableHead className="text-right">{ts.infoStatusCount}</TableHead>
                <TableHead className="text-right">{ts.infoProportion}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statusCounts.status_counts.map((status) => {
                const percent = (status.count / total) * 100;
                return (
                  <TableRow key={status.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="h-2 flex-1 rounded-full bg-secondary">
                          <span className="block h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} />
                        </span>
                        <StatusBadge tone="info">{textForLanguage(status, language)}</StatusBadge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(status.count, language)}</TableCell>
                    <TableCell className="text-right tabular-nums">{percent.toFixed(1)}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t.byNationality}</CardTitle>
          <CardDescription>{t.nationalityHelp}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-80 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{ts.infoCountry}</TableHead>
                  <TableHead className="text-right">{ts.infoStatusCount}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {countries.map((country) => (
                  <TableRow key={country.name}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="h-2 flex-1 rounded-full bg-secondary">
                          <span className="block h-2 rounded-full bg-primary" style={{ width: `${(country.count / maxCountry) * 100}%` }} />
                        </span>
                        <span>{country.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(country.count, language)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LinkList({ title, intro, links }: { title: string; intro?: string; links: Array<[string, string]> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {intro ? <CardDescription>{intro}</CardDescription> : null}
      </CardHeader>
      <CardContent className="divide-y">
        {links.map(([label, href]) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center justify-between gap-3 py-3 text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {label}
            <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
          </a>
        ))}
      </CardContent>
    </Card>
  );
}
