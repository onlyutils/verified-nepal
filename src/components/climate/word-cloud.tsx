import { useEffect, useMemo, useRef, useState } from "react";
import { getClimateMessages } from "@/lib/api";
import { climateSeriesColor } from "@/lib/climate-colors";
import { drawWordCloud } from "@/lib/climate-share";
import { messageText } from "@/lib/climate-messages";
import { layoutWordCloud, type CloudWord, type PlacedWord } from "@/lib/word-cloud";
import { interpolate } from "@/lib/format";
import type { CountryClimate } from "@/lib/climate-data";
import { ShareButton } from "@/components/climate/share-button";
import { Button } from "@/components/ui/button";

export function WordCloud({
  t,
  language: _language,
  countries,
  selectedIso3,
  refreshKey,
  message,
}: {
  t: Record<string, string>;
  language: "en" | "ne";
  countries: CountryClimate[];
  selectedIso3: string | null;
  refreshKey: number;
  message?: string;
}) {
  const [mode, setMode] = useState<"all" | "country">("all");
  const [words, setWords] = useState<CloudWord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const measureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  const selectedCountry = countries.find((country) => country.iso3 === selectedIso3);
  const activeCountry = mode === "country" ? selectedCountry : undefined;

  useEffect(() => {
    if (!selectedIso3 && mode === "country") setMode("all");
  }, [mode, selectedIso3]);

  useEffect(() => {
    let active = true;
    const country = mode === "country" ? (selectedIso3 ?? undefined) : undefined;
    setLoading(true);
    void getClimateMessages(country)
      .then((response) => {
        if (!active) return;
        const counts = new Map<string, number>();
        for (const item of response.items) counts.set(item.messageId, (counts.get(item.messageId) ?? 0) + item.count);
        setWords([...counts.entries()].map(([messageId, weight]) => ({ text: messageText(messageId), weight })));
        setTotal([...counts.values()].reduce((sum, count) => sum + count, 0));
      })
      .catch(() => {
        if (!active) return;
        setWords([]);
        setTotal(0);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode, refreshKey, selectedIso3]);

  useEffect(() => {
    if (measureCanvasRef.current) setCanvasReady(true);
  }, []);

  const placed = useMemo<PlacedWord[]>(() => {
    if (!canvasReady) return [];
    const context = measureCanvasRef.current?.getContext("2d");
    if (!context) return [];
    return layoutWordCloud(words, {
      width: 960,
      height: 520,
      // Messages are full phrases (with an emoji prefix), not single words, so keep the
      // top end modest — a 72px phrase can be nearly canvas-wide and starve everything else.
      minSize: 12,
      maxSize: 40,
      padding: 6,
      measure: (text, size) => {
        context.font = `700 ${size}px 'Noto Sans', 'Noto Sans Devanagari', system-ui, sans-serif, 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji'`;
        return { width: context.measureText(text).width, height: size * 1.2 };
      },
    });
  }, [canvasReady, words]);

  const cloudSubline = activeCountry ? interpolate(t.cloudCountry, { country: activeCountry.name }) : t.cloudAll;

  return (
    <div className="space-y-4">
      <canvas ref={measureCanvasRef} className="hidden" aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-1 rounded-md border p-0.5">
        <Button type="button" size="sm" variant={mode === "all" ? "default" : "ghost"} onClick={() => setMode("all")}>
          {t.cloudAll}
        </Button>
        {selectedCountry ? (
          <Button type="button" size="sm" variant={mode === "country" ? "default" : "ghost"} onClick={() => setMode("country")}>
            {interpolate(t.cloudCountry, { country: selectedCountry.name })}
          </Button>
        ) : null}
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t.loading}
        </p>
      ) : null}
      {!loading && !placed.length ? <p className="text-sm text-muted-foreground">{t.cloudEmpty}</p> : null}
      {placed.length ? (
        <svg viewBox="0 0 960 520" className="h-auto w-full" role="img" aria-label={t.cloudTitle}>
          {placed.map((word, index) => (
            <text
              key={word.text}
              x={word.x}
              y={word.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontWeight="700"
              fontSize={word.size}
              fill={climateSeriesColor(index)}
              transform={word.rotated ? `rotate(-90 ${word.x} ${word.y})` : undefined}
            >
              {word.text}
            </text>
          ))}
        </svg>
      ) : null}
      <p className="text-sm text-muted-foreground">{interpolate(t.cloudCount, { count: total })}</p>
      <ShareButton
        kind="wordcloud"
        filename="verifiednepal-climate-wordcloud.png"
        headline={t.cloudTitle}
        subline={cloudSubline}
        footnote={interpolate(t.cloudCount, { count: total })}
        message={message}
        draw={(ctx, box) => drawWordCloud(ctx, box, { words: placed, width: 960, height: 520 })}
        labels={{ download: t.downloadImage, share: t.shareImage, exportError: t.exportError }}
      />
    </div>
  );
}
