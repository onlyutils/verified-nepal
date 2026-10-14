import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { adsStrings } from "@/i18n/ads";
import { getAd, type AdSlotName, type PublicAd } from "@/lib/api";
import type { Language } from "@/lib/types";

export function AdSlot({ slot, district, municipalityId, language }: {
  slot: AdSlotName;
  district?: string;
  municipalityId?: string | number;
  language: Language;
}) {
  const key = JSON.stringify([slot, district, municipalityId]);
  const [result, setResult] = useState<{ key: string; ad: PublicAd | null } | null>(null);
  useEffect(() => {
    let current = true;
    setResult(null);
    void getAd(slot, district, municipalityId).then(
      ({ ad }) => { if (current) setResult({ key, ad }); },
      () => { if (current) setResult(null); },
    );
    return () => { current = false; };
  }, [slot, district, municipalityId, key]);
  const ad = result?.key === key ? result.ad : null;
  if (!ad || !/^https?:\/\//i.test(ad.href) || !/^https?:\/\//i.test(ad.image.url)) return null;
  const t = adsStrings[language];
  return (
    <Card className="overflow-hidden print:hidden">
      <p className="px-5 pt-5 text-xs text-muted-foreground">
        <span lang={language}>{t.sponsoredFirst}</span> / <span lang={language === "en" ? "ne" : "en"}>{t.sponsoredSecond}</span>
      </p>
      <a href={ad.href} rel="sponsored noopener noreferrer" target="_blank"
        className="flex min-h-11 flex-col gap-3 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        {/* ponytail: Reserve a fixed image ratio; upgrade to stored image dimensions when the API provides them. */}
        <img src={ad.image.url} loading="lazy" alt={ad.label[language]} className="aspect-video w-full object-contain" />
        <span className="break-words text-sm" lang={language}>{ad.label[language]}</span>
        <span className="text-xs text-muted-foreground">{t.adOpens}</span>
      </a>
    </Card>
  );
}
