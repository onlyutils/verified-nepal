import type { Language } from "@/lib/types";

/** The Bhote Koshi flood: 26 Aug 2026, Nepal time. */
const responseStart = Date.parse("2026-08-26T00:00:00+05:45");
const dayMs = 86_400_000;

export function responseDay(now: Date = new Date()) {
  return Math.max(1, Math.floor((now.getTime() - responseStart) / dayMs) + 1);
}

export function fillTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
}

export function leadHeadline(
  t: { leadHeadline: string; leadHeadlineNoMissing: string },
  rescued: string,
  missing: string | null,
) {
  return missing === null
    ? fillTemplate(t.leadHeadlineNoMissing, { rescued })
    : fillTemplate(t.leadHeadline, { rescued, missing });
}

export function formatEditionDate(now: Date, language: Language) {
  return new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kathmandu",
  }).format(now);
}
