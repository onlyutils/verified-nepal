import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/page-header";
import { formatRelativeTime } from "@/lib/format-date";
import { fetchHighlights, NEWS_SITE_BASE, type HighlightItem } from "@/lib/highlights";
import { highlightsStrings } from "@/i18n/highlights";
import type { Language } from "@/lib/types";

export function LocalUpdatesHighlights({ language }: { language: Language }) {
  const [items, setItems] = useState<HighlightItem[] | null>(null);
  const t = highlightsStrings[language];

  useEffect(() => {
    let active = true;
    fetchHighlights().then((result) => {
      if (active) setItems(result.slice(0, 6));
    });
    return () => {
      active = false;
    };
  }, []);

  if (!items?.length) return null;
  return (
    <section aria-labelledby="local-updates-title" className="bg-background">
      <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <SectionHeader id="local-updates-title" title={t.title} />
        <ul className="divide-y rounded-xl border">
          {items.map((item) => (
            <li key={item.id} className="flex min-w-0 flex-col gap-2 p-5">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" lang={item.language}>
                  {item.language === "ne" ? t.languageNe : t.languageEn}
                </Badge>
                {item.place ? <span>{item.place}</span> : null}
                <time dateTime={item.happenedAt}>{formatRelativeTime(item.happenedAt, language)}</time>
              </div>
              <h3 className="text-base font-semibold">
                <a
                  href={item.href}
                  lang={item.language}
                  target="_blank"
                  rel="noopener"
                  className="flex min-h-11 items-center break-words text-primary hover:underline"
                >
                  {item.title}
                </a>
              </h3>
            </li>
          ))}
        </ul>
        <Button asChild variant="outline">
          <a href={NEWS_SITE_BASE}>{t.seeAll}</a>
        </Button>
      </div>
    </section>
  );
}
