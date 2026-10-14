import type { Language } from "@/lib/types";
import { formatDateline } from "./format-date.ts";
import { disasterStart } from "./disasters.ts";

const responseStart = disasterStart();
const dayMs = 86_400_000;

export function responseDay(now: Date = new Date()) {
  return Math.max(1, Math.floor((now.getTime() - responseStart) / dayMs) + 1);
}

export function fillTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
}

export function leadHeadline(t: { leadHeadline: string; leadHeadlineNoMissing: string }, rescued: string, missing: string | null) {
  return missing === null ? fillTemplate(t.leadHeadlineNoMissing, { rescued }) : fillTemplate(t.leadHeadline, { rescued, missing });
}

export function formatEditionDate(now: Date, language: Language) {
  return formatDateline(now, language);
}
