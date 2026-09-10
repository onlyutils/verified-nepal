import { ExternalLink, MapPin, Phone, TriangleAlert } from "lucide-react";
import { labels } from "@/i18n";
import { floodReliefStrings } from "@/i18n/flood-relief";
import { shellStrings } from "@/i18n/shell";
import { pmdrfUrl } from "@/lib/urls";
import type { Language, Page } from "@/lib/types";
import { Button } from "@/components/ui/button";

const container = "mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8";

export function EmergencyBar({ language, navigate }: { language: Language; navigate: (page: Page) => void }) {
  const t = labels[language];
  const ts = shellStrings[language];
  const fs = floodReliefStrings[language];
  return (
    <aside aria-label={t.emergencyStripLabel} className="emergency-bar bg-destructive text-destructive-foreground">
      <div className="mx-auto flex h-10 w-full max-w-7xl items-center justify-center gap-1 px-2 text-[11px] sm:hidden">
        <a
          href="tel:1234"
          className="inline-flex min-h-10 items-center whitespace-nowrap font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {ts.emergencyCompactPrompt} <span className="ml-1 underline underline-offset-2">1234</span>
        </a>
        <span aria-hidden="true">·</span>
        <a
          href="tel:100"
          className="inline-flex min-h-10 items-center whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {t.policeShort} <span className="ml-1 font-bold tabular-nums">100</span>
        </a>
        <span aria-hidden="true">·</span>
        <a
          href="tel:102"
          className="inline-flex min-h-10 items-center whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {t.ambulanceShort} <span className="ml-1 font-bold tabular-nums">102</span>
        </a>
      </div>
      <div className={`${container} hidden sm:flex`}>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <a
            href="tel:1234"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <TriangleAlert className="size-4" aria-hidden="true" />
            {ts.emergencyPrompt} <span className="underline underline-offset-2">1234</span>
          </a>
          <EmergencyPhone number="100" label={t.policeShort} />
          <EmergencyPhone number="102" label={t.ambulanceShort} />
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full border-white bg-transparent text-white hover:bg-white hover:text-destructive lg:w-auto"
            onClick={() => navigate("dropCenters")}
          >
            <MapPin aria-hidden="true" /> {fs.emergencyBarCta}
          </Button>
          <Button
            asChild
            type="button"
            variant="outline"
            className="min-h-11 w-full border-white bg-transparent text-white hover:bg-white hover:text-destructive lg:w-auto"
          >
            <a href={pmdrfUrl} target="_blank" rel="noopener noreferrer">
              {ts.emergencyDonate} <ExternalLink aria-hidden="true" />
            </a>
          </Button>
        </div>
      </div>
    </aside>
  );
}

function EmergencyPhone({ number, label }: { number: string; label: string }) {
  return (
    <a
      href={`tel:${number}`}
      className="inline-flex min-h-11 items-center gap-2 rounded-md bg-white/15 px-3 text-xs font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Phone className="size-3" aria-hidden="true" />
      {label} <span className="font-bold tabular-nums">{number}</span>
    </a>
  );
}
