import { useState } from "react";
import { Play } from "lucide-react";
import { SectionHeader } from "@/components/page-header";
import { floodImpactStrings } from "@/i18n/flood-impact";
import type { FloodMedia } from "@/lib/flood-manifest";
import type { Language } from "@/lib/types";

function FloodMediaCard({ item, playVideo }: { item: FloodMedia; playVideo: string }) {
  const [youtubeLoaded, setYoutubeLoaded] = useState(false);

  return (
    <article className="mb-4 break-inside-avoid overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-border/60">
      <div className="relative w-full overflow-hidden bg-muted" style={{ aspectRatio: `${item.width}/${item.height}` }}>
        {item.kind === "image" ? (
          <img src={item.src} loading="lazy" decoding="async" alt={item.caption} className="size-full object-cover" />
        ) : item.kind === "video" ? (
          <video src={item.src} poster={item.poster ?? undefined} controls preload="none" playsInline className="size-full" />
        ) : youtubeLoaded ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${item.src}?autoplay=1`}
            title={item.caption}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            className="size-full"
          />
        ) : (
          <button
            type="button"
            aria-label={`${playVideo}: ${item.caption}`}
            onClick={() => setYoutubeLoaded(true)}
            className="group relative size-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <img src={item.poster ?? item.src} loading="lazy" decoding="async" alt="" className="size-full object-cover" />
            <span
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm transition-transform group-hover:scale-105 group-focus-visible:scale-105"
            >
              <Play className="size-6 fill-current" />
            </span>
          </button>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium leading-snug">{item.caption}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {item.credit} · {item.license} ·{" "}
          <a href={item.href} target="_blank" rel="noopener" className="underline-offset-2 hover:underline">
            {item.source}
          </a>
        </p>
      </div>
    </article>
  );
}

export function FloodMediaGallery({ language, items }: { language: Language; items: FloodMedia[] }) {
  const t = floodImpactStrings[language];
  if (items.length === 0) return null;

  return (
    <section className="mt-14">
      <SectionHeader title={t.mediaHeading} />
      <p className="mt-2 text-sm text-muted-foreground">{t.mediaLead}</p>
      <div className="mt-4 columns-1 sm:columns-2 lg:columns-3 gap-4">
        {items.map((item) => (
          <FloodMediaCard key={`${item.kind}-${item.src}`} item={item} playVideo={t.playVideo} />
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{t.mediaNote}</p>
    </section>
  );
}
