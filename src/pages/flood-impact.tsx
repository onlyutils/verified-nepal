import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Eyebrow, SectionHeader } from "@/components/page-header";
import { BeforeAfterSlider } from "@/components/before-after-slider";
import { FloodImpactMap } from "@/components/flood-impact-map";
import { fetchFloodManifest, FloodManifestError, type FloodManifest } from "@/lib/flood-manifest";
import { floodImpactStrings } from "@/i18n/flood-impact";
import type { Language } from "@/lib/types";

const MANIFEST_URL = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_FLOOD_MANIFEST_URL as string | undefined;
const AUTOPLAY_INTERVAL_MS = 4000;

export function FloodImpact({ language }: { language: Language }) {
  const t = floodImpactStrings[language];
  const [manifest, setManifest] = useState<FloodManifest | null>(null);
  const [error, setError] = useState<"not_found" | "invalid" | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

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
    if (!playing || !manifest) return;
    const id = setInterval(() => {
      setActiveIndex((i) => (i + 1) % manifest.frames.length);
    }, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [playing, manifest]);

  useEffect(() => {
    cardRefs.current[activeIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIndex]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center text-muted-foreground">{error === "not_found" ? t.notPublished : t.loadError}</div>
    );
  }

  if (!manifest) {
    return <div className="mx-auto max-w-2xl py-16 text-center text-muted-foreground">…</div>;
  }

  return (
    <div>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <SectionHeader title={t.pageTitle} />
      <p className="mt-3 max-w-2xl text-muted-foreground">{t.lead}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-20 lg:h-fit">
          <FloodImpactMap frames={manifest.frames} activeIndex={activeIndex} onSelect={setActiveIndex} aoi={manifest.aoi} />
          <div className="mt-4 flex items-center gap-3">
            <Button type="button" onClick={() => setPlaying((p) => !p)}>
              {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
              {playing ? t.pause : t.play}
            </Button>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={showOverlay} onCheckedChange={(checked) => setShowOverlay(checked === true)} />
              {t.showClassification}
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {manifest.frames.map((frame, index) => (
            <Card
              key={frame.week}
              ref={(el: HTMLDivElement | null) => {
                cardRefs.current[index] = el;
              }}
              className={`p-4 transition-shadow ${index === activeIndex ? "ring-2 ring-primary" : ""}`}
              onClick={() => setActiveIndex(index)}
            >
              <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                <span>{frame.location.label}</span>
                <span>
                  {frame.dateRange[0]} – {frame.dateRange[1]}
                </span>
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
            </Card>
          ))}
        </div>
      </div>

      {manifest.timelapseGifUrl ? (
        <div className="mt-12">
          <SectionHeader title={t.timelapseHeading} />
          <p className="mb-3 text-sm text-muted-foreground">{t.timelapseCaption}</p>
          <img src={manifest.timelapseGifUrl} alt={t.timelapseHeading} className="w-full max-w-3xl rounded-lg" />
        </div>
      ) : null}
    </div>
  );
}
