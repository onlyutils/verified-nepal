import type { Language } from "./types.ts";
import { districtLabels, type DistrictName } from "./districts.ts";
import { disasterDateLabel, type Disaster } from "./disasters.ts";

export type PosterTemplateId = "paper" | "blue";
export type PosterSize = "feed" | "story";
export type PosterStatus = "missing" | "found";
export type PosterGender = "" | "woman" | "man" | "other";

export interface PosterInput {
  name: string;
  nickname: string;
  age: string;
  gender: PosterGender;
  district: string;
  place: string;
  lastSeenAt: string;
  clothing: string;
  story: string;
  phones: [string, string];
  status: PosterStatus;
  language: Language;
  template: PosterTemplateId;
  size: PosterSize;
}

export interface PosterStrings {
  headlineMissing: string;
  headlineFound: string;
  since: string;
  sinceFound: string;
  lastSeen: string;
  age: string;
  contact: string;
  nickname: string;
  woman: string;
  man: string;
  other: string;
  brandUrl: string;
}

export const EMPTY_POSTER: PosterInput = {
  name: "",
  nickname: "",
  age: "",
  gender: "",
  district: "",
  place: "",
  lastSeenAt: "",
  clothing: "",
  story: "",
  phones: ["", ""],
  status: "missing",
  language: "en",
  template: "paper",
  size: "feed",
};

export const POSTER_SIZES: Record<PosterSize, { width: number; height: number }> = {
  feed: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

export const POSTER_LIMITS = { name: 60, nickname: 30, place: 60, clothing: 120, story: 280 } as const;

function districtLabel(district: string, language: Language) {
  const entry = (districtLabels as Record<string, { en: string; ne: string } | undefined>)[district];
  return entry ? entry[language] : district;
}

export function disasterLine(disaster: Disaster, district: string, language: Language, t: PosterStrings, status: PosterStatus = "missing") {
  const template = status === "found" ? t.sinceFound : t.since;
  const parts = [template.replace("{disaster}", disaster.name[language]), disasterDateLabel(disaster, language)];
  if (district) parts.push(districtLabel(district as DistrictName, language));
  return parts.join(" · ");
}

export function personLine(input: PosterInput, t: PosterStrings) {
  const name = input.nickname.trim() ? `${input.name.trim()} (${input.nickname.trim()})` : input.name.trim();
  const parts = [name];
  if (input.age.trim()) parts.push(`${t.age} ${input.age.trim()}`);
  if (input.gender) parts.push(t[input.gender]);
  return parts.join(" · ");
}

function formatLastSeen(value: string, language: Language) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language === "ne" ? "ne-NP" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function lastSeenLine(input: PosterInput, t: PosterStrings) {
  const where = [input.place.trim(), input.district ? districtLabel(input.district, input.language) : ""].filter(Boolean).join(", ");
  const when = input.lastSeenAt ? formatLastSeen(input.lastSeenAt, input.language) : "";
  return `${t.lastSeen}: ${[where, when].filter(Boolean).join(" · ")}`;
}

/** Greedy word wrap; the last allowed line gets an ellipsis when text remains. */
export function wrapText(measure: (s: string) => number, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) <= maxWidth || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines) {
      lines[maxLines - 1] = `${lines[maxLines - 1]}…`;
      return lines;
    }
  }
  if (current) {
    if (lines.length === maxLines) lines[maxLines - 1] = `${lines[maxLines - 1]}…`;
    else lines.push(current);
  }
  return lines;
}

/** Source rectangle that covers a box of boxW×boxH from an image of imgW×imgH, centred. */
export function coverRect(imgW: number, imgH: number, boxW: number, boxH: number) {
  const scale = Math.max(boxW / imgW, boxH / imgH);
  const sw = Math.round(boxW / scale);
  const sh = Math.round(boxH / scale);
  return { sx: Math.round((imgW - sw) / 2), sy: Math.round((imgH - sh) / 2), sw, sh };
}

export function posterFilename(input: PosterInput) {
  const slug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${input.status}-${slug || "poster"}-${input.size}.png`;
}

const PHONE = /^[0-9]{7,15}$/;

export function validatePoster(input: PosterInput) {
  const errors: Partial<Record<keyof PosterInput, true>> = {};
  if (!input.name.trim()) errors.name = true;
  if (!input.district) errors.district = true;
  if (!input.place.trim()) errors.place = true;
  const phones = input.phones.map((p) => p.replace(/[\s-]/g, "")).filter(Boolean);
  if (phones.length === 0 || phones.some((p) => !PHONE.test(p))) errors.phones = true;
  return errors;
}
