// Plain-text share metadata for an article. Used by functions/articles/[id].ts
// (Cloudflare Pages) to rewrite index.html's <title> and Open Graph tags so a
// shared link previews the article instead of the generic site card.
import countries from "../../public/data/climate/countries.json" with { type: "json" };
import units from "./admin-units.json" with { type: "json" };
import { districtLabels, type DistrictName } from "./districts.ts";
import { articlesPublicStrings } from "../i18n/articles-public.ts";
import { interpolate } from "./format.ts";

type Localized = string | { en: string; ne?: string };

export interface DispatchLike {
  kind?: "article" | "news";
  language?: "en" | "ne";
  locality?: { district: string; municipalityId: string | number; ward?: number };
  happenedAt?: string;
  title: Localized;
  body: Localized;
  author?: { displayName?: string; place?: string };
  cover?: { url?: string; caption?: string };
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectLike {
  title: Localized;
  description: Localized;
  photos?: Array<{ url: string; caption?: string; status: "pending" | "published" }>;
}

export interface CenterLike {
  name: string;
  district: string;
  status: "open" | "paused" | "closed";
}

export interface ShareMeta {
  title: string;
  description: string;
  image?: string;
  imageAlt?: string;
}

function text(value: Localized | undefined): string {
  if (!value) return "";
  return typeof value === "string" ? value : value.en || value.ne || "";
}

export function dispatchLocality(locality: DispatchLike["locality"], language: "en" | "ne"): string {
  if (!locality) return "";
  const municipality = units.find((unit) => String(unit.id) === String(locality.municipalityId) && unit.district === locality.district);
  const district = districtLabels[locality.district as DistrictName]?.[language] || locality.district;
  return [district, municipality ? (language === "ne" ? municipality.nameNe : municipality.name) : "",
    locality.ward == null ? "" : `${articlesPublicStrings[language].ward} ${new Intl.NumberFormat(language === "ne" ? "ne-NP" : "en-GB").format(locality.ward)}`,
  ].filter(Boolean).join(" · ");
}

function dispatchText(value: Localized, item: DispatchLike): string {
  if (item.kind !== "news" || typeof value === "string") return text(value);
  return (item.language === "ne" ? value.ne || value.en : value.en || value.ne) || "";
}

export function dispatchMeta(item: DispatchLike): ShareMeta {
  const title = dispatchText(item.title, item).trim() || (item.kind === "news" ? articlesPublicStrings[item.language || "en"].localUpdate : "Article");
  if (item.kind === "news") {
    const locality = dispatchLocality(item.locality, item.language || "en");
    const prefix = locality ? `${locality} — ` : "";
    const description = `${prefix}${dispatchText(item.body, item).replace(/\s+/g, " ").trim().slice(0, Math.max(0, 155 - prefix.length))}`;
    const image = item.cover?.url?.trim();
    return image
      ? { title: `${title} · verifiedNepal`, description, image, imageAlt: item.cover?.caption?.trim() || title }
      : { title: `${title} · verifiedNepal`, description };
  }
  const by = [item.author?.displayName, item.author?.place].filter(Boolean).join(", ");
  const suffix = by ? ` — By ${by}` : "";
  const excerpt = text(item.body)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 155 - suffix.length);
  const description = `${excerpt}${suffix}`;
  const image = item.cover?.url?.trim();
  return image
    ? { title: `${title} · verifiedNepal`, description, image, imageAlt: item.cover?.caption?.trim() || title }
    : { title: `${title} · verifiedNepal`, description };
}

export function dispatchJsonLd(item: DispatchLike, canonical: string): Record<string, unknown> {
  const title = dispatchText(item.title, item).trim() || (item.kind === "news" ? articlesPublicStrings[item.language || "en"].localUpdate : "Article");
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    mainEntityOfPage: canonical,
    url: canonical,
    ...((item.kind === "news" ? item.happenedAt : item.createdAt) ? { datePublished: item.kind === "news" ? item.happenedAt : item.createdAt } : {}),
    ...(item.updatedAt || item.createdAt ? { dateModified: item.updatedAt ?? item.createdAt } : {}),
    ...(item.cover?.url ? { image: item.cover.url } : {}),
    ...(item.author?.displayName ? { author: { "@type": "Person", name: item.author.displayName } } : {}),
    publisher: {
      "@type": "Organization",
      name: "verifiedNepal",
      url: "https://verifiednepal.com/",
      logo: { "@type": "ImageObject", url: "https://verifiednepal.com/brand/logo-mark.svg" },
    },
    inLanguage: item.kind === "news" ? item.language || "en" : "en",
  };
}

export function projectMeta(project: ProjectLike): ShareMeta {
  const title = text(project.title).trim() || "Community project";
  const description = text(project.description).replace(/\s+/g, " ").trim().slice(0, 155);
  const cover = project.photos?.find((photo) => photo.status === "published" && photo.url?.trim());
  return cover
    ? { title: `${title} · verifiedNepal`, description, image: cover.url.trim(), imageAlt: cover.caption?.trim() || title }
    : { title: `${title} · verifiedNepal`, description };
}

export function centerMeta(center: CenterLike): ShareMeta {
  const statusWord = center.status === "open" ? "Open" : center.status === "paused" ? "Paused" : "Closed";
  return {
    title: `${center.name} · verifiedNepal`,
    description: `${statusWord} drop center in ${center.district}. See live stock and recent activity, or bring goods to donate.`,
  };
}

/** Static per-page share cards for public pages with no per-request data. Image paths are site-relative. */
export const STATIC_PAGE_META: Record<string, ShareMeta> = {
  poster: {
    title: "Make a missing-person poster · verifiedNepal",
    description: "Make a bilingual missing-person poster in minutes and download it ready for print or social media.",
    image: "/brand/og-poster.png",
  },
  missing: {
    title: "Someone missing? Do this first · verifiedNepal",
    description: "A volunteer-written guide to the official channels and helplines, in the order that helps most.",
    image: "/brand/og-missing.png",
  },
  getHelp: {
    title: "Get help — register a need · verifiedNepal",
    description: "Register a need in minutes — a moderator reviews it before anything goes public. Your name stays masked.",
    image: "/brand/og-get-help.png",
  },
  giveHelp: {
    title: "Give help · verifiedNepal",
    description: "Verified requests with masked identities — respond to a need or register an offer, connected through a moderator.",
    image: "/brand/og-give-help.png",
  },
  dropCenters: {
    title: "Drop centers · verifiedNepal",
    description: "Live stock and activity from independent relief centers across Nepal — food, water and shelter goods, logged in the open.",
    image: "/brand/og-drop-centers.png",
  },
  projects: {
    title: "Community projects · verifiedNepal",
    description: "Verified infrastructure projects — tuin, bridges, trails, water and schools. Money goes straight to local committees.",
    image: "/brand/og-projects.png",
  },
  floodImpact: {
    title: "Trishuli flood — before and after · verifiedNepal",
    description: "Explore satellite before-and-after imagery of the Trishuli flash flood, from Rasuwa through Trishuli Bazaar and Devighat to Chitwan.",
    image: "/brand/og-card.png",
  },
  info: {
    title: "Info & help · verifiedNepal",
    description: "Find official rescue links and emergency helplines, learn how to donate safely, and understand how this volunteer-run, community-verified site works.",
    image: "/brand/og-card.png",
  },
  howTo: {
    title: "How VerifiedNepal works · verifiedNepal",
    description: "A practical guide to finding and giving disaster relief in Nepal, what moderators verify, and how requests move from review to delivery.",
    image: "/brand/og-card.png",
  },
  ourMessage: {
    title: "Your message becomes Nepal's message · verifiedNepal",
    description: "Send a message from Nepal to a country you choose. Each message joins the live word cloud and is counted with messages from others.",
    image: "/brand/og-card.png",
  },
  articles: {
    title: "Articles · verifiedNepal",
    description: "Read moderated community writing on mountains and climate: editorial articles with a community voice, not an open forum.",
    image: "/brand/og-card.png",
  },
  privacy: {
    title: "Privacy and terms · verifiedNepal",
    description: "Read the terms and privacy policy: what information the volunteer-run site collects, why it is used, and how public records are handled.",
    image: "/brand/og-card.png",
  },
  ledger: {
    title: "Public goods ledger · verifiedNepal",
    description: "Follow relief goods from a helper or drop center through receipt and delivery, with public records of where support has gone.",
    image: "/brand/og-card.png",
  },
  audit: {
    title: "Public audit log · verifiedNepal",
    description: "Review the public audit log of moderation and status decisions, with recorded actions that make the response process accountable.",
    image: "/brand/og-card.png",
  },
  coverage: {
    title: "Coverage by ward · verifiedNepal",
    description: "See where verified help has reached and where it has not, by ward, from the public register refreshed every five minutes.",
    image: "/brand/og-card.png",
  },
  incidents: {
    title: "Verified incidents · verifiedNepal",
    description: "Browse current and past community-reported emergencies that moderators have verified, with summaries and affected districts.",
    image: "/brand/og-card.png",
  },
  drones: {
    title: "Drone tasking board · verifiedNepal",
    description: "Coordinate drone payload requests, landing sites and flight plans to support active disaster response incidents in Nepal.",
    image: "/brand/og-card.png",
  },
};

export function climateMeta(): ShareMeta {
  const countryList = countries as typeof countries &
    Array<{
      iso3: string;
      warming_c: number;
      lulucf_c: number | null;
      share_pct: number;
      name: string;
    }>;
  const nepal = countryList.find((country) => country.iso3 === "NPL");
  const sorted = [...countryList].sort((a, b) => b.warming_c - a.warming_c);
  const top = sorted[0];
  if (!nepal || !top) throw new Error("Climate dataset is missing Nepal or its top country");
  const description = interpolate(
    "Nepal caused {nepalShare}% of global warming (rank {nepalRank} of {total}) yet bears the floods and landslides. {topName} caused {ratio}x more.",
    {
      nepalShare: nepal.share_pct.toFixed(2),
      nepalRank: sorted.findIndex((country) => country.iso3 === "NPL") + 1,
      total: countryList.length,
      topName: top.name,
      ratio: Math.round(top.warming_c / nepal.warming_c),
    },
  );
  return {
    title: `Nepal caused ${nepal.share_pct.toFixed(2)}% of global warming · verifiedNepal`,
    description,
  };
}
