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
}

export interface ShareMeta {
  title: string;
  description: string;
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
  return { title: `${title} · verifiedNepal`, description };
}

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
