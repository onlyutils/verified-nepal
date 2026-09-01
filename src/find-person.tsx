import { labels, textForLanguage } from "./i18n";
import { useLiveData } from "./live";
import type { Language, Page } from "./types";
import { opmcmMissingPersonUrl } from "./urls";
import { formatNumber, messageText } from "./utils";
import { Byline, Headline, Rule, RuledTable, SectionLabel, SquareButton, Standfirst } from "./ui";

export function FindPerson({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  const t = labels[language];
  const liveData = useLiveData();
  const rescued = formatNumber(liveData.rescuedStatistics.rescued_count, language);
  const verified = formatNumber(liveData.statusCounts.total_count, language);
  const missing = liveData.missingCount === null ? t.unavailable : formatNumber(liveData.missingCount, language);
  const number = (value: number | null | undefined) =>
    value === null || value === undefined ? t.unavailable : formatNumber(value, language);
  const disclaimers = liveData.messages.map((message) => messageText(message, language)).filter(Boolean);
  const total = Math.max(liveData.statusCounts.total_count, 1);

  return (
    <div className="space-y-8">
      <section aria-labelledby="search-heading">
        <SectionLabel as="p">{t.missingPersonsLabel}</SectionLabel>
        <Headline level={2} as="h1" id="search-heading" className="mt-4">
          {t.searchTitle}
        </Headline>
        <Standfirst className="mt-3 max-w-2xl">{t.searchIntro}</Standfirst>
        <div className="mt-6 flex flex-wrap gap-3">
          <SquareButton href={opmcmMissingPersonUrl} external tone="primary">
            {t.searchByNameCta}
          </SquareButton>
          <SquareButton onClick={() => navigate("missing")} tone="red">
            {t.missingGuideLink}
          </SquareButton>
        </div>
      </section>

      <Rule />

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <SectionLabel as="p">{t.byTheNumbers}</SectionLabel>
          <RuledTable
            caption={t.byTheNumbers}
            className="mt-1"
            rows={[
              { key: "rescued", label: t.rescuedStatus, value: rescued },
              { key: "missing", label: t.missing, value: missing, red: true },
              { key: "reach", label: t.outOfReach, value: number(liveData.rescuedStatistics.out_of_reach) },
              { key: "force", label: t.forceDeployed, value: number(liveData.rescuedStatistics.force_deployed) },
              { key: "verified", label: t.verifiedRecords, value: verified },
            ]}
          />
          <Byline language={language} className="mt-2" />
        </div>
        <div>
          <SectionLabel as="p">{t.statusOfRecords}</SectionLabel>
          <RuledTable
            caption={t.statusOfRecords}
            className="mt-1"
            rows={liveData.statusCounts.status_counts.map((status) => ({
              key: String(status.id),
              label: textForLanguage(status, language),
              value: (
                <>
                  {formatNumber(status.count, language)}
                  <span className="ml-2 font-normal text-muted">{((status.count / total) * 100).toFixed(1)}%</span>
                </>
              ),
              bar: status.count / total,
            }))}
          />
        </div>
      </section>

      <Rule />

      <DisclaimerBlock language={language} disclaimers={disclaimers} />
    </div>
  );
}

function DisclaimerBlock({ language, disclaimers }: { language: Language; disclaimers: string[] }) {
  const t = labels[language];
  const fallback =
    language === "ne"
      ? "यो सूचना NDRRMA को सार्वजनिक तथ्यांकबाट लिइएको हो। कृपया आधिकारिक पेजमा पुष्टि गर्नुहोस्।"
      : "This information mirrors NDRRMA public data. Please verify details on the official page.";

  return (
    <aside className="border-l border-ink pl-4 font-serif text-sm leading-6 text-muted">
      <p className="font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">{t.officialDisclaimer}</p>
      <p className="mt-2 text-ink">{t.absenceNote}</p>
      {(disclaimers.length ? disclaimers : [fallback]).map((disclaimer, index) => (
        <p key={`${disclaimer}-${index}`} className="mt-2">
          {disclaimer}
        </p>
      ))}
    </aside>
  );
}
