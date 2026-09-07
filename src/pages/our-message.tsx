import { useState } from "react";
import { climateData, climateFacts } from "@/lib/climate-data";
import { ourMessageStrings } from "@/i18n/our-message";
import { messageText } from "@/lib/climate-messages";
import type { Language } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, SectionHeader } from "@/components/page-header";
import { MessageWall } from "@/components/climate/message-wall";
import { WordCloud } from "@/components/climate/word-cloud";

export function OurMessagePage({ language }: { language: Language }) {
  const t = ourMessageStrings[language];
  const facts = climateFacts();
  const { countries } = climateData;
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedCountryIso3, setSelectedCountryIso3] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const pageMessage = selectedMessageId ? messageText(selectedMessageId) : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader eyebrow={t.eyebrow} title={t.title} description={t.description} />

      <div className="space-y-3">
        <SectionHeader title={t.cloudTitle} />
        <WordCloud
          t={t}
          language={language}
          countries={countries}
          selectedIso3={selectedCountryIso3}
          refreshKey={refreshKey}
          message={pageMessage}
        />
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="space-y-3 pt-6">
          <h2 className="text-xl font-bold text-foreground">{t.messagesTitle}</h2>
          <p className="text-sm text-muted-foreground">{t.messagesDescription}</p>
          <MessageWall
            language={language}
            t={t}
            countries={countries}
            facts={facts}
            onSent={(messageId, iso3) => {
              setSelectedMessageId(messageId);
              setSelectedCountryIso3(iso3);
              setRefreshKey((key) => key + 1);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
