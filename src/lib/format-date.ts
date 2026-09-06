import type { Language } from "./types";

const TIME_ZONE = "Asia/Kathmandu";

function localeFor(language: Language) {
  return language === "ne" ? "ne-NP" : "en-GB";
}

export function formatDateTime(value: string | number | Date, language: Language) {
  const formatted = new Intl.DateTimeFormat(localeFor(language), {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
  return `${formatted} NPT`;
}

export function formatMonth(value: string | number | Date, language: Language) {
  return new Intl.DateTimeFormat(localeFor(language), {
    timeZone: TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export function formatNumber(value: number, language: Language, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(localeFor(language), options).format(value);
}
