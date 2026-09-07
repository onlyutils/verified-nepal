import { Check } from "lucide-react";
import { needTimelineStrings } from "@/i18n/needs";
import { formatDateTime } from "@/lib/format-date";
import type { NeedTimelineStep } from "@/lib/api";
import type { Language } from "@/lib/types";

export function NeedTimeline({ steps, language }: { steps?: NeedTimelineStep[]; language: Language }) {
  if (!steps?.length) return null;
  const labels = needTimelineStrings[language];
  return (
    <ol className="space-y-2" aria-label={labels.timeline}>
      {steps.map((step) => (
        <li key={`${step.key}-${step.at}`} className="flex items-center gap-2 text-sm">
          <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="font-medium">{labels[step.key]}</span>
          <time className="text-muted-foreground" dateTime={step.at}>{formatDateTime(step.at, language)}</time>
        </li>
      ))}
    </ol>
  );
}
