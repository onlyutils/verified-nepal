import type { Language } from "./types";
import { BS_MONTHS_EN, BS_MONTHS_NE, toBikramSambat, toDevanagariDigits } from "./bs-calendar.ts";

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

export function formatDate(value: string | number | Date | null | undefined, language: Language): string {
  const date = validDate(value);
  if (!date) return "";
  const parts = new Intl.DateTimeFormat(localeFor(language), {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(date);
  // Keep the masthead's day–month–year order while Intl supplies localized names and digits.
  return ["day", "month", "year"].map((type) => parts.find((part) => part.type === type)!.value).join(" ");
}

export function formatRelativeTime(value: string | number | Date | null | undefined, language: Language, now: Date = new Date()): string {
  const date = validDate(value);
  if (!date || Number.isNaN(now.getTime())) return "";
  const difference = date.getTime() - now.getTime();
  const magnitude = Math.abs(difference);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (magnitude > 30 * day) return formatDate(date, language);
  if (magnitude < minute) {
    // ponytail: Move this bilingual pair to shared date i18n when that file is in scope.
    const justNow = { en: "just now", ne: "अहिले" };
    return justNow[language];
  }
  const unit = magnitude >= day ? "day" : magnitude >= hour ? "hour" : "minute";
  const duration = unit === "day" ? day : unit === "hour" ? hour : minute;
  return new Intl.RelativeTimeFormat(localeFor(language), { numeric: "auto" }).format(Math.trunc(difference / duration), unit);
}

// Invalid/missing input returns ""; only dates outside BS 2070–2095 throw RangeError.
// The home masthead passes today's date, which is inside this table.
export function formatBsDate(value: string | number | Date | null | undefined, language: Language): string {
  const date = validDate(value);
  if (!date) return "";
  const { year, month, day } = toBikramSambat(date);
  if (language === "ne") {
    // The date fixtures use वैशाख; preserve the separately specified बैशाख export.
    const monthName = month === 1 ? "वैशाख" : BS_MONTHS_NE[month - 1];
    return `${monthName} ${toDevanagariDigits(day)}, ${toDevanagariDigits(year)}`;
  }
  return `${BS_MONTHS_EN[month - 1]} ${day}, ${year}`;
}

// Like formatBsDate, valid dates outside the supported BS table throw RangeError.
export function formatDateline(value: string | number | Date | null | undefined, language: Language): string {
  const date = validDate(value);
  if (!date) return "";
  const bsDate = formatBsDate(date, language);
  const weekday = new Intl.DateTimeFormat(localeFor(language), {
    timeZone: TIME_ZONE,
    weekday: "long",
  }).format(date);
  return `${weekday}, ${bsDate} (${formatDate(date, language)})`;
}
