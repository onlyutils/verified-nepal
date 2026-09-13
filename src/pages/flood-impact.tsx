import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Check, FastForward, ListOrdered, Maximize2, Minimize2, Pause, Play, Rewind, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow, SectionHeader } from "@/components/page-header";
import { FloodMediaGallery } from "@/components/flood-media-gallery";
import {
  afterTilesBaseUrl,
  fetchAfterTilesMeta,
  fetchFloodMedia,
  fetchFloodManifest,
  fetchFloodSceneData,
  fetchRiverPath,
  FloodManifestError,
  type FloodAfterScenesData,
  type FloodAfterTilesMeta,
  type FloodMedia,
  type FloodManifest,
  type RiverPath,
} from "@/lib/flood-manifest";
import { selectStoryFrames, slugify, storyStartIndex } from "@/lib/flood-after-scenes";
import { floodImpactStrings } from "@/i18n/flood-impact";
import type { Language } from "@/lib/types";

const MANIFEST_URL = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_FLOOD_MANIFEST_URL as string | undefined;
const FloodImpactMap = lazy(() => import("@/components/flood-impact-map").then((module) => ({ default: module.FloodImpactMap })));
const PLAYBACK_SPEEDS = [0.5, 1, 2, 4] as const;

export function FloodImpact({ language }: { language: Language }) {
  const t = floodImpactStrings[language];
  const [manifest, setManifest] = useState<FloodManifest | null>(null);
  const [sceneData, setSceneData] = useState<FloodAfterScenesData | null>(null);
  const [riverPath, setRiverPath] = useState<RiverPath | null>(null);
  const [media, setMedia] = useState<FloodMedia[]>([]);
  const [afterTiles, setAfterTiles] = useState<{ baseUrl: string; meta: FloodAfterTilesMeta } | null>(null);
  const [error, setError] = useState<"not_found" | "invalid" | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [seekRequest, setSeekRequest] = useState<{ id: number; offsetMeters: number } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false);
  const fullscreenActive = fullscreen || pseudoFullscreen;
  const activeItemRef = useRef<HTMLLIElement>(null);
  const stopListRef = useRef<HTMLDivElement>(null);
  const stopListHandleRef = useRef<HTMLButtonElement>(null);
  const [listOpen, setListOpen] = useState(false);

  const storyFrames = useMemo(
    () => (manifest && sceneData ? selectStoryFrames(manifest.frames, sceneData) : []),
    [manifest, sceneData],
  );
  const storyStart = sceneData ? storyStartIndex(storyFrames, sceneData) : 0;

  useEffect(() => {
    if (!MANIFEST_URL) {
      setError("not_found");
      return;
    }
    Promise.all([
      fetchFloodManifest(MANIFEST_URL),
      fetchAfterTilesMeta(MANIFEST_URL),
      fetchFloodSceneData(MANIFEST_URL),
      fetchFloodMedia(MANIFEST_URL),
      fetchRiverPath(MANIFEST_URL),
    ])
      .then(([nextManifest, meta, nextSceneData, nextMedia, nextRiverPath]) => {
        setManifest(nextManifest);
        setSceneData(nextSceneData);
        setRiverPath(nextRiverPath);
        setMedia(nextMedia);
        setAfterTiles(meta ? { baseUrl: afterTilesBaseUrl(MANIFEST_URL), meta } : null);
      })
      .catch((err: unknown) => setError(err instanceof FloodManifestError ? err.code : "invalid"));
  }, []);

  useEffect(() => {
    if (!listOpen) return;
    const panel = stopListRef.current;
    const item = activeItemRef.current;
    if (panel && item) panel.scrollTop = item.offsetTop - panel.clientHeight / 2 + item.clientHeight / 2;
  }, [activeIndex, listOpen]);

  useEffect(() => {
    if (stopListRef.current) stopListRef.current.inert = !listOpen;
  }, [listOpen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(!!document.fullscreenElement && document.fullscreenElement === wrapperRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    handleFullscreenChange();
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!pseudoFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPseudoFullscreen(false);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [pseudoFullscreen]);

  // Deep link: `?loc=<slug>` on page load selects the matching waypoint. Runs once the
  // manifest arrives (manifest only changes reference the one time it's fetched).
  useEffect(() => {
    if (!manifest) return;
    const loc = new URLSearchParams(window.location.search).get("loc");
    if (!loc) {
      setActiveIndex(storyStart);
      return;
    }
    const index = storyFrames.findIndex((item) => slugify(item.location.label) === loc);
    if (index >= 0) setActiveIndex(index);
  }, [manifest, storyFrames, storyStart]);

  // Keep the URL in sync with the active waypoint (map click, sidebar click, slideshow all
  // funnel through setActiveIndex) so the current URL is always shareable as-is.
  useEffect(() => {
    if (!manifest) return;
    const url = new URL(window.location.href);
    const frame = storyFrames[activeIndex];
    if (!frame) return;
    url.searchParams.set("loc", slugify(frame.location.label));
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }, [manifest, activeIndex, storyFrames]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center text-muted-foreground">
        {error === "not_found" ? t.notPublished : t.loadError}
      </div>
    );
  }

  if (!manifest || !sceneData || !riverPath) {
    return <div className="mx-auto max-w-2xl py-16 text-center text-muted-foreground">…</div>;
  }

  const frame = storyFrames[activeIndex];
  const shareUrl = (() => {
    const url = new URL(window.location.href);
    url.searchParams.set("loc", slugify(frame.location.label));
    return url.toString();
  })();

  const handleShare = async () => {
    const shareData = { title: `${frame.location.label} — ${t.pageTitle}`, text: `${frame.location.label}: ${t.shareText}`, url: shareUrl };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled the share sheet, or the platform declined it — nothing to do
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (http, old WebView). Nothing more we can do.
    }
  };

  const toggleFullscreen = () => {
    try {
      if (document.fullscreenEnabled) {
        if (fullscreen) {
          void document.exitFullscreen().catch(() => {});
        } else if (wrapperRef.current) {
          void wrapperRef.current.requestFullscreen().catch(() => {});
        }
      } else {
        setPseudoFullscreen((value) => !value);
      }
    } catch {
      // Fullscreen can be unavailable or rejected synchronously.
    }
  };

  const requestSeek = (offsetMeters: number) => {
    setSeekRequest((previous) => ({ id: (previous?.id ?? 0) + 1, offsetMeters }));
  };

  return (
    <div>
      <Eyebrow>{t.eyebrow}</Eyebrow>
      <SectionHeader title={t.pageTitle} />
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">{t.lead}</p>

      <div
        ref={wrapperRef}
        className={`flex w-full flex-col overflow-hidden bg-background ring-1 ring-border/60 shadow-sm ${
          pseudoFullscreen
            ? "fixed inset-0 z-[2000] mt-0 h-[100dvh] w-screen rounded-none"
            : "relative mt-8 rounded-xl sm:block sm:h-[75vh] sm:min-h-[32rem]"
        }`}
      >
        <p
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2 select-none whitespace-nowrap text-xs font-medium tracking-wide text-white/70 [text-shadow:0_1px_2px_rgba(0,0,0,.6)]"
        >
          verifiednepal.com/flood-impact
        </p>

        <Suspense
          fallback={
            <div
              className={fullscreenActive ? "absolute inset-0 bg-muted" : "h-80 bg-muted sm:absolute sm:inset-0 sm:!h-full"}
            />
          }
        >
          <FloodImpactMap
            frames={storyFrames}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
            onPlaybackEnd={() => setPlaying(false)}
            aoi={manifest.aoi}
            afterTiles={afterTiles}
            sceneData={sceneData}
            playing={playing}
            language={language}
            preparingImagery={t.preparingImagery}
            speedMultiplier={playbackSpeed}
            seekRequest={seekRequest}
            noDataStretchLabel={t.noDataStretch}
            skipAheadLabel={t.skipAhead}
            riverPath={riverPath}
            className={fullscreenActive ? "absolute inset-0 !h-full" : "h-80 sm:absolute sm:inset-0 sm:!h-full"}
          />
        </Suspense>

        <div
          className={
            fullscreenActive
              ? "pointer-events-none absolute inset-x-3 bottom-3 z-[1000] flex justify-center"
              : "flex justify-center bg-background px-3 py-2 sm:pointer-events-none sm:absolute sm:inset-x-3 sm:bottom-3 sm:z-[1000] sm:bg-transparent sm:p-0"
          }
        >
          <div className="pointer-events-auto inline-flex max-w-full items-center justify-start gap-1 overflow-x-auto rounded-full bg-background/60 p-0.5 opacity-70 shadow-md backdrop-blur transition-opacity [scrollbar-width:none] [&::-webkit-scrollbar]:hidden hover:opacity-100 focus-within:opacity-100 sm:p-1">
            <Button
              type="button"
              variant="default"
              size="icon"
              aria-label={playing ? t.pause : t.play}
              aria-pressed={playing}
              onClick={() => setPlaying((value) => !value)}
              className="h-9 w-9 shrink-0 rounded-full sm:h-11 sm:w-11 [&_svg]:size-4 sm:[&_svg]:size-5"
            >
              {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label={fullscreenActive ? t.exitFullscreen : t.fullscreen}
              aria-pressed={fullscreenActive}
              onClick={toggleFullscreen}
              className="h-9 w-9 shrink-0 rounded-full sm:h-11 sm:w-11 [&_svg]:size-4 sm:[&_svg]:size-5"
            >
              {fullscreenActive ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
            </Button>

            <div aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border sm:h-6" />

            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label={t.back5km}
              onClick={() => requestSeek(-5000)}
              className="h-8 min-h-0 shrink-0 gap-1 rounded-full px-2 text-[11px] font-medium tabular-nums sm:h-9 sm:min-h-9 sm:px-3 sm:text-xs"
            >
              <Rewind aria-hidden="true" className="size-3 sm:size-3.5" />
              <span>−5 km</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label={t.back1km}
              onClick={() => requestSeek(-1000)}
              className="h-8 min-h-0 shrink-0 gap-1 rounded-full px-2 text-[11px] font-medium tabular-nums sm:h-9 sm:min-h-9 sm:px-3 sm:text-xs"
            >
              <Rewind aria-hidden="true" className="size-3 sm:size-3.5" />
              <span>−1 km</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label={t.forward1km}
              onClick={() => requestSeek(1000)}
              className="h-8 min-h-0 shrink-0 gap-1 rounded-full px-2 text-[11px] font-medium tabular-nums sm:h-9 sm:min-h-9 sm:px-3 sm:text-xs"
            >
              <FastForward aria-hidden="true" className="size-3 sm:size-3.5" />
              <span>+1 km</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label={t.forward5km}
              onClick={() => requestSeek(5000)}
              className="h-8 min-h-0 shrink-0 gap-1 rounded-full px-2 text-[11px] font-medium tabular-nums sm:h-9 sm:min-h-9 sm:px-3 sm:text-xs"
            >
              <FastForward aria-hidden="true" className="size-3 sm:size-3.5" />
              <span>+5 km</span>
            </Button>

            <div aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border sm:h-6" />

            <div role="group" aria-label={t.speed} className="flex min-h-7 shrink-0 items-center rounded-full bg-muted p-0.5 sm:min-h-9">
              {PLAYBACK_SPEEDS.map((speed) => (
                <Button
                  key={speed}
                  type="button"
                  size="sm"
                  variant={playbackSpeed === speed ? "secondary" : "ghost"}
                  aria-pressed={playbackSpeed === speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className="h-7 min-h-0 min-w-7 shrink-0 rounded-full px-1.5 text-[11px] sm:h-9 sm:min-h-9 sm:min-w-9 sm:px-2 sm:text-xs"
                >
                  {speed}×
                </Button>
              ))}
            </div>

            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label={linkCopied ? t.linkCopied : t.share}
              onClick={() => void handleShare()}
              className="h-9 w-9 shrink-0 rounded-full sm:h-11 sm:w-11 [&_svg]:size-4 sm:[&_svg]:size-5"
            >
              {linkCopied ? <Check aria-hidden="true" /> : <Share2 aria-hidden="true" />}
            </Button>
            <span className="sr-only shrink-0" aria-live="polite">
              {linkCopied ? t.linkCopied : ""}
            </span>
          </div>
        </div>

        <div
          className="absolute inset-y-0 right-0 z-[1000] flex items-center"
          onMouseLeave={() => setListOpen(false)}
        >
          <div
            ref={stopListRef}
            id="flood-impact-stops"
            aria-hidden={!listOpen}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              setListOpen(false);
              stopListHandleRef.current?.focus();
            }}
            className={`pointer-events-auto absolute right-0 top-0 h-full w-60 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain bg-background/90 p-2 shadow-lg backdrop-blur transition-transform duration-300 ease-out ${
              listOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between gap-2 px-1 pb-1">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.stops}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t.close}
                onClick={() => setListOpen(false)}
                className="min-h-11 min-w-11 shrink-0 rounded-full"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <ol aria-label={t.stops} className="flex flex-col gap-1">
              {storyFrames.map((item, index) => (
                <li key={item.location.label} ref={index === activeIndex ? activeItemRef : undefined}>
                  <button
                    type="button"
                    aria-current={index === activeIndex ? "true" : undefined}
                    className={`flex min-h-9 w-full items-center rounded-md px-2.5 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      index === activeIndex ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent/60"
                    }`}
                    onClick={() => {
                      setActiveIndex(index);
                      setListOpen(false);
                    }}
                  >
                    <span className="mr-2 shrink-0 opacity-70 tabular-nums">{index + 1}.</span>
                    <span className="truncate">{item.location.label}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label={t.stops}
            aria-expanded={listOpen}
            aria-controls="flood-impact-stops"
            ref={stopListHandleRef}
            onMouseEnter={() => setListOpen(true)}
            onFocus={() => setListOpen(true)}
            onClick={() => setListOpen(true)}
            className={`pointer-events-auto h-9 w-9 shrink-0 rounded-l-full rounded-r-none bg-background/60 shadow-md backdrop-blur transition-opacity hover:opacity-100 focus-within:opacity-100 sm:h-11 sm:w-11 [&_svg]:size-4 sm:[&_svg]:size-5 ${
              listOpen ? "pointer-events-none opacity-0" : "opacity-70"
            }`}
          >
            <ListOrdered aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <dl className="contents">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.factDateLabel}</dt>
            <dd className="font-semibold">{t.factDate}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.factSourceLabel}</dt>
            <dd className="font-semibold">{t.factSource}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.factReachLabel}</dt>
            <dd className="font-semibold">{t.factReach}</dd>
          </div>
        </dl>
      </div>

      <FloodMediaGallery language={language} items={media} />

      <p className="mt-10 border-t pt-4 text-xs text-muted-foreground">{t.imageryCredit}</p>
    </div>
  );
}
