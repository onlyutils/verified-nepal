// Plain-text share metadata for an article. Used by functions/articles/[id].ts
// (Cloudflare Pages) to rewrite index.html's <title> and Open Graph tags so a
// shared link previews the article instead of the generic site card.
import countries from "../../public/data/climate/countries.json" with { type: "json" };
import { interpolate } from "./format.ts";

type Localized = string | { en: string; ne?: string };

export interface DispatchLike {
  title: Localized;
  body: Localized;
  author?: { displayName?: string; place?: string };
  cover?: { url?: string; caption?: string };
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

export function dispatchMeta(item: DispatchLike): ShareMeta {
  const title = text(item.title).trim() || "Article";
  const excerpt = text(item.body).replace(/\s+/g, " ").trim().slice(0, 200);
  const by = [item.author?.displayName, item.author?.place].filter(Boolean).join(", ");
  const description = [excerpt, by ? `By ${by}` : ""].filter(Boolean).join(" — ");
  const image = item.cover?.url?.trim();
  return image
    ? { title: `${title} · verifiedNepal`, description, image, imageAlt: item.cover?.caption?.trim() || title }
    : { title: `${title} · verifiedNepal`, description };
}

export function projectMeta(project: ProjectLike): ShareMeta {
  const title = text(project.title).trim() || "Community project";
  const description = text(project.description).replace(/\s+/g, " ").trim().slice(0, 200);
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
    title: "Missing-person posters · verifiedNepal",
    description: "Make a bilingual missing-person poster in minutes and share it — or browse posters and call if you recognise someone.",
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
    "Nepal caused {nepalShare}% of global warming, rank {nepalRank} of {total}. {topName} caused {ratio} times more. The floods, landslides and melting glaciers arrive here anyway. Every number on this page is from a peer-reviewed dataset of emissions since 1851.",
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
