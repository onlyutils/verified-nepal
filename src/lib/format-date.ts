import type { Language } from "./types";

const TIME_ZONE = "Asia/Kathmandu";

function localeFor(language: Language) {
  return language === "ne" ? "ne-NP" : "en-GB";
}

function validDate(value: string | number | Date | null | undefined) {
  if (value === null || value === undefined) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value: string | number | Date | null | undefined, language: Language) {
  const date = validDate(value);
  if (!date) return "";
  const formatted = new Intl.DateTimeFormat(localeFor(language), {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${formatted} NPT`;
}

export function formatMonth(value: string | number | Date | null | undefined, language: Language) {
  const date = validDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(localeFor(language), {
    timeZone: TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatNumber(value: number, language: Language, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(localeFor(language), options).format(value);
}
