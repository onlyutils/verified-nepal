import { ExternalLink, Phone, TriangleAlert } from "lucide-react";
import { labels } from "@/i18n";
import { shellStrings } from "@/i18n/shell";
import { pmdrfUrl } from "@/lib/urls";
import type { Language } from "@/lib/types";
import { Button } from "@/components/ui/button";

const container = "mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8";

export function EmergencyBar({ language }: { language: Language }) {
  const t = labels[language];
  const ts = shellStrings[language];
  return (
    <aside aria-label={t.emergencyStripLabel} className="bg-destructive text-destructive-foreground">
      <div className={container}>
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
