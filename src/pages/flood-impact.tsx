import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Eyebrow, SectionHeader } from "@/components/page-header";
import { BeforeAfterSlider } from "@/components/before-after-slider";
import { FloodImpactMap } from "@/components/flood-impact-map";
import { fetchFloodManifest, FloodManifestError, type FloodManifest } from "@/lib/flood-manifest";
import { floodImpactStrings } from "@/i18n/flood-impact";
import type { Language } from "@/lib/types";

const MANIFEST_URL = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_FLOOD_MANIFEST_URL as string | undefined;
const AUTOPLAY_INTERVAL_MS = 3000;

export function FloodImpact({ language }: { language: Language }) {
  const t = floodImpactStrings[language];
  const [manifest, setManifest] = useState<FloodManifest | null>(null);
  const [error, setError] = useState<"not_found" | "invalid" | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const activeItemRef = useRef<HTMLLIElement>(null);

  // The page shows plain optical satellite photographs only — radar frames read as
  // technical imagery to a general audience, so they are left out.
  const frames = manifest ? manifest.frames.filter((frame) => frame.source === "s2") : [];

  useEffect(() => {
    if (!MANIFEST_URL) {
      setError("not_found");
      return;
    }
    fetchFloodManifest(MANIFEST_URL)
      .then(setManifest)
      .catch((err: unknown) => setError(err instanceof FloodManifestError ? err.code : "invalid"));
  }, []);

  useEffect(() => {
    if (!playing || frames.length === 0) return;
    const id = setInterval(() => {
      setActiveIndex((i) => (i + 1) % frames.length);
    }, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [playing, frames.length]);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center text-muted-foreground">
        {error === "not_found" ? t.notPublished : t.loadError}
      </div>
    );
  }

  if (!manifest) {
    return <div className="mx-auto max-w-2xl py-16 text-center text-muted-foreground">…</div>;
  }

  const frame = manifest.frames[activeIndex];
  const coverage = manifest.coverageReport.find((report) => report.week === frame.week);

  return (
    <div>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <SectionHeader title={t.pageTitle} />
      <p className="mt-3 max-w-2xl text-muted-foreground">{t.lead}</p>

      <div className="relative mt-8 flex w-full flex-col gap-3 overflow-hidden rounded-lg sm:h-[75vh] sm:min-h-[32rem]">
        <FloodImpactMap
          frames={manifest.frames}
          activeIndex={activeIndex}
          onSelect={setActiveIndex}
          aoi={manifest.aoi}
          className="!h-80 shrink-0 sm:absolute sm:inset-0 sm:!h-full"
        />

        <div className="w-full shrink-0 rounded-lg border bg-background/95 p-2 shadow-lg backdrop-blur sm:absolute sm:bottom-3 sm:right-3 sm:top-3 sm:z-[1000] sm:w-64 sm:overflow-y-auto">
          <div className="flex flex-col gap-2 border-b pb-2">
            <Button type="button" onClick={() => setPlaying((p) => !p)} className="w-full">
              {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
              {playing ? t.pause : t.play}
            </Button>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <Checkbox checked={showOverlay} onCheckedChange={(checked) => setShowOverlay(checked === true)} />
              {t.showClassification}
            </label>
          </div>
          <ol className="mt-2 flex flex-col gap-1" aria-label={t.frame}>
            {manifest.frames.map((item, index) => (
              <li key={item.location.label} ref={index === activeIndex ? activeItemRef : undefined}>
                <button
                  type="button"
                  aria-current={index === activeIndex ? "true" : undefined}
                  className={`flex min-h-14 w-full flex-col justify-center rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    index === activeIndex ? "bg-accent ring-1 ring-primary" : "hover:bg-accent/60"
                  }`}
                  onClick={() => setActiveIndex(index)}
                >
                  <span className="truncate font-semibold text-foreground">{item.location.label}</span>
                  {item.location.arrivalLabel ? (
                    <span className="truncate text-xs text-muted-foreground">{item.location.arrivalLabel}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="w-full shrink-0 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur sm:absolute sm:bottom-3 sm:left-3 sm:z-[1000] sm:w-[calc(100%-1.5rem)] sm:max-w-md">
          <div className="mb-3 flex items-start justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{frame.location.label}</p>
              {frame.location.arrivalLabel ? <p className="mt-1 font-medium text-foreground">{frame.location.arrivalLabel}</p> : null}
              <p className="text-xs text-muted-foreground">
                {frame.dateRange[0]} – {frame.dateRange[1]}
              </p>
            </div>
            <Badge variant={frame.source === "s1" ? "warning" : "info"} className="shrink-0 text-center">
              {frame.source === "s1" ? t.coverageBadgeS1 : t.coverageBadgeS2}
              {coverage ? ` · ${Math.round(coverage.validPixelPct)}%` : null}
            </Badge>
          </div>
          <BeforeAfterSlider
            beforeUrl={frame.beforeUrl}
            afterUrl={frame.afterUrl}
            beforeLabel={t.before}
            afterLabel={t.after}
            overlayUrl={frame.classOverlayUrl}
            showOverlay={showOverlay}
          />
          <p className="mt-2 text-xs text-muted-foreground">{frame.source === "s1" ? t.cloudGapNote : t.sourceS2}</p>
        </div>
      </div>

      {manifest.timelapseGifUrl ? (
        <div className="mt-12">
          <SectionHeader title={t.timelapseHeading} />
          <p className="mb-3 text-sm text-muted-foreground">{t.timelapseCaption}</p>
          <img src={manifest.timelapseGifUrl} alt={t.timelapseHeading} className="w-full max-w-3xl rounded-lg" />
        </div>
      ) : null}

      <p className="mt-10 text-xs text-muted-foreground">{t.imageryCredit}</p>
    </div>
  );
}
