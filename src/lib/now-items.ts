import type { DispatchDetailResponse, DispatchPublicItem, LedgerItem } from "./api.ts";
import type { Language, OpmcmGovernmentEffort } from "./types.ts";
import { nowStrings } from "../i18n/now.ts";
import { municipalityById, municipalityLabel } from "./admin-units.ts";
import { districtLabels, type DistrictName } from "./districts.ts";
import { formatBsDate, formatRelativeTime } from "./format-date.ts";
import { toDevanagariDigits } from "./bs-calendar.ts";
import { opmcmUpdatesUrl } from "./urls.ts";

export interface NowItem {
  id: string;
  kind: "official" | "delivery" | "local-update" | "standing";
  title: string;
  place?: string;
  happenedAt: string | null;
  source: { label: string; url: string | null };
  trust: "official" | "checked" | null;
  href: string;
  language: Language;
  body?: string;
  shareCard?: ReturnType<typeof localUpdateShareCard>;
}

// ponytail: The public ledger type omits locality fields; remove this extension when api.ts exposes them.
export type NowLedgerItem = LedgerItem & { municipalityId?: number | string; municipality?: string };

function textField(item: OpmcmGovernmentEffort, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function writtenLanguage(text: string): Language {
  // ponytail: Legacy OPMCM and ledger items have no language field; use script detection until the feeds declare it.
  return /[\u0900-\u097f]/u.test(text) ? "ne" : "en";
}

function webUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function placeLabel(district: string, municipalityId: number | string | undefined, municipality: string | undefined, ward: number | undefined, language: Language) {
  const local = municipalityId == null ? undefined : municipalityById(Number(municipalityId));
  // ponytail: Older ledger rows lack a municipality; show their district until the feed includes municipalityId.
  const place = local ? municipalityLabel(local, language) : municipality || districtLabels[district as DistrictName]?.[language] || district;
  const wardLabel = ward == null ? "" : nowStrings[language].ward.replace("{ward}", language === "ne" ? toDevanagariDigits(ward) : String(ward));
  return [place, wardLabel].filter(Boolean).join(" · ");
}

export function officialNowItem(item: OpmcmGovernmentEffort, language: Language): NowItem {
  const title = textField(item, ["title", "title_ne", "title_en", "titleEn", "englishTitle", "titleEnglish"]) || nowStrings[language].officialSource;
  const body = textField(item, ["description", "description_ne", "description_en", "summary", "content"]);
  return {
    id: `official:${item._id}`,
    kind: "official",
    title,
    place: textField(item, ["agency"]) || nowStrings[language].opmcm,
    happenedAt: item.createdAt ?? null,
    source: { label: nowStrings[language].opmcm, url: opmcmUpdatesUrl },
    trust: "official",
    href: opmcmUpdatesUrl,
    language: writtenLanguage(title + body),
    body: body || undefined,
  };
}

export function deliveryNowItem(item: NowLedgerItem, language: Language, index = 0): NowItem {
  const label = item.orgName || item.deliveredBy?.label || nowStrings[language].moderator;
  return {
    id: `delivery:${item.redeemedAt}:${index}`,
    kind: "delivery",
    title: `${nowStrings[language].delivered} · ${label}`,
    place: placeLabel(item.district, item.municipalityId, item.municipality, item.ward, language),
    happenedAt: item.confirmedAt ?? item.redeemedAt,
    source: { label: nowStrings[language].deliverySource, url: "/ledger" },
    trust: null,
    href: "/ledger",
    language,
  };
}

export function localUpdateNowItem(item: DispatchPublicItem, language: Language): NowItem {
  const itemLanguage = item.language ?? (typeof item.title === "string" ? writtenLanguage(item.title) : item.title.ne ? "ne" : "en");
  const title = typeof item.title === "string" ? item.title : item.title[itemLanguage] || item.title.en || item.title.ne || nowStrings[language].readUpdate;
  const href = `/articles/${encodeURIComponent(item.id)}`;
  const url = item.sourceUrls?.map(webUrl).find((value) => value !== null) ?? null;
  const excerpt = typeof item.excerpt === "string" ? item.excerpt : item.excerpt[itemLanguage] || item.excerpt.en || item.excerpt.ne || "";
  return {
    id: `local-update:${item.id}`,
    kind: "local-update",
    title,
    place: item.locality ? placeLabel(item.locality.district, item.locality.municipalityId, undefined, item.locality.ward, language) : undefined,
    happenedAt: item.happenedAt ?? null,
    source: url ? { label: new URL(url).hostname, url } : item.sourceNote?.trim() ? { label: item.sourceNote.trim(), url: null } : { label: nowStrings[language].readUpdate, url: href },
    trust: "checked",
    href,
    language: itemLanguage,
    // ponytail: The list API supplies an excerpt; use full paragraph blocks when that endpoint exposes them.
    shareCard: localUpdateShareCard({ id: item.id, title, place: localUpdatePlace(item.locality, language), happenedAt: item.happenedAt, excerpt }, language),
  };
}

export function localUpdatePlace(locality: DispatchPublicItem["locality"], language: Language): string {
  if (!locality) return "";
  const municipality = municipalityById(Number(locality.municipalityId));
  return [
    districtLabels[locality.district as DistrictName]?.[language] || locality.district,
    municipality?.district === locality.district ? municipalityLabel(municipality, language) : "",
    locality.ward == null ? "" : nowStrings[language].ward.replace("{ward}", language === "ne" ? toDevanagariDigits(locality.ward) : String(locality.ward)),
  ].filter(Boolean).join(" · ");
}

export function localUpdateBodyText(item: Pick<DispatchDetailResponse, "blocks" | "body">, language: Language): string {
  const text = item.blocks?.length
    ? item.blocks.flatMap((block) => block.type === "paragraph" ? [block.text] : []).join(" ")
    : typeof item.body === "string" ? item.body : item.body[language] || item.body.en || item.body.ne || "";
  return text;
}

export function localUpdateExcerpt(text: string): string {
  const plain = text.replace(/\s+/gu, " ").trim();
  if (plain.length <= 220) return plain;
  const words = plain.split(" ");
  let excerpt = "";
  for (const word of words) {
    const next = excerpt ? `${excerpt} ${word}` : word;
    if (next.length > 220) break;
    excerpt = next;
  }
  return `${excerpt}…`;
}

export function localUpdateShareCard(item: { id: string; title: string; place?: string; happenedAt?: string | null; excerpt: string }, language: Language) {
  return {
    filename: `verifiednepal-local-update-${item.id}.png`,
    headline: item.title,
    subline: [item.place, formatBsDate(item.happenedAt, language)].filter(Boolean).join(" · "),
    message: localUpdateExcerpt(item.excerpt),
    footnote: `${nowStrings[language].checked} · verifiednepal.com/articles/${encodeURIComponent(item.id)}`,
  };
}

export function standingNowItems(language: Language): NowItem[] {
  return [
    { id: "standing:flood", title: nowStrings[language].standingFloodImpact, href: "/flood-impact" },
    { id: "standing:ledger", title: nowStrings[language].standingLedger, href: "/ledger" },
  ].map((item) => ({ ...item, kind: "standing", happenedAt: null, source: { label: "", url: null }, trust: null, language }));
}

export function sortNowItems(items: NowItem[]): NowItem[] {
  return items.filter((item) => item.kind !== "standing" && item.happenedAt && Number.isFinite(Date.parse(item.happenedAt)))
    .sort((a, b) => Date.parse(b.happenedAt!) - Date.parse(a.happenedAt!));
}

export function normaliseNowItems(sources: { official: OpmcmGovernmentEffort[]; ledger: NowLedgerItem[]; localUpdates: DispatchPublicItem[] }, language: Language) {
  const ledger = sortNowItems(sources.ledger.map((item, index) => deliveryNowItem(item, language, index))).slice(0, 10);
  const localUpdates = sortNowItems(sources.localUpdates.filter((item) => item.kind === "news").map((item) => localUpdateNowItem(item, language))).slice(0, 10);
  const all = sortNowItems([...sources.official.map((item) => officialNowItem(item, language)), ...ledger, ...localUpdates]);
  return { all, visible: all.slice(0, 10), standing: standingNowItems(language), latestAt: all[0]?.happenedAt ?? null };
}

export function nowEmptyMessage(latestAt: string | null, language: Language, now: Date = new Date()) {
  const time = formatRelativeTime(latestAt, language, now);
  return time ? nowStrings[language].nowEmpty.replace("{time}", time) : nowStrings[language].nowNoUpdates;
}

export function nowShareText(item: NowItem, language: Language, origin: string, now: Date = new Date()) {
  return [item.title, item.place, formatRelativeTime(item.happenedAt, language, now), new URL(item.href, origin).href].filter(Boolean).join("\n");
}
