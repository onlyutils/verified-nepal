import type { Language, MessageItem, PersonRecord } from "./types";

const officialRescueUrl = "https://ndrrma.gov.np/en/rescue";

export { officialRescueUrl };

export function formatNumber(value: number, language: Language) {
  return new Intl.NumberFormat(language === "ne" ? "ne-NP" : "en-US").format(value);
}

export function formatDateTime(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function normalizeSearch(value: string) {
  return value
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

interface SearchablePerson {
  name?: string | null;
  name_ne?: string | null;
  display_name?: string | null;
}

const devanagariPattern = /\p{Script=Devanagari}/u;
const markPattern = /\p{M}/gu;

function normalizeLatinSearch(value: string) {
  return normalizeSearch(value.normalize("NFD").replace(markPattern, ""));
}

export function matchesPerson(person: SearchablePerson, query: string) {
  const normalizedQuery = normalizeSearch(query);
  if (normalizedQuery.length < 2) return false;

  const tokens = normalizedQuery.split(" ").filter(Boolean);
  const directHaystack = normalizeSearch(
    [person.name, person.name_ne, person.display_name].filter(Boolean).join(" "),
  );
  const latinHaystack = normalizeLatinSearch(directHaystack);

  return tokens.every((token) => {
    if (devanagariPattern.test(token)) return directHaystack.includes(token);
    return latinHaystack.includes(normalizeLatinSearch(token));
  });
}

export function countryKey(person: PersonRecord) {
  return person.country || person.nationality || "Unknown";
}

export function sentenceCase(value: string | null | undefined) {
  if (!value) return "";
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1).toLocaleLowerCase())
    .join(" ");
}

export function statusTone(statusId?: number) {
  if (statusId === 1) return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (statusId === 3) return "bg-amber-50 text-amber-900 ring-amber-200";
  if (statusId === 4) return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  return "bg-sky-50 text-sky-900 ring-sky-200";
}

export function extractMessages(raw: MessageItem[] | { results?: MessageItem[] }) {
  return Array.isArray(raw) ? raw : raw.results ?? [];
}

export function messageText(message: MessageItem, language: Language) {
  const ne = message.message_ne || message.description_ne || message.content_ne || message.title_ne;
  const en = message.message || message.description || message.content || message.title;
  return String((language === "ne" ? ne || en : en || ne) || "");
}
