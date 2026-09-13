import type { Language } from "@/lib/types";

export const reachStrings: Record<
  Language,
  {
    nav: string;
    title: string;
    description: string;
    viewsToday: string;
    viewsLast30: string;
    visitsLast30: string;
    viewsAllTime: string;
    last30Days: string;
    views: string;
    sessions: string;
    dropCenters: string;
    floodImpact: string;
    last30: string;
    allTime: string;
    topPaths: string;
    path: string;
    allPages: string;
    page: string;
    referrers: string;
    host: string;
    visits: string;
    languages: string;
    language: string;
    english: string;
    nepali: string;
    loading: string;
    empty: string;
    noPaths: string;
    noLocation: string;
  }
> = {
  en: {
    nav: "Reach",
    title: "Page reach",
    description: "First-party page views and visits across verifiedNepal.",
    viewsToday: "Views today",
    viewsLast30: "Views in the last 30 days",
    visitsLast30: "Visits in the last 30 days",
    viewsAllTime: "Views all time",
    last30Days: "Last 30 days",
    views: "Views",
    sessions: "Sessions",
    dropCenters: "Drop centers",
    floodImpact: "Flood impact",
    last30: "Last 30 days",
    allTime: "All time",
    topPaths: "Top paths",
    path: "Path",
    allPages: "All pages",
    page: "Page",
    referrers: "Referrers",
    host: "Host",
    visits: "Visits",
    languages: "Languages",
    language: "Language",
    english: "English",
    nepali: "Nepali",
    loading: "Loading reach stats…",
    empty: "No page reach data yet.",
    noPaths: "No paths recorded yet.",
    noLocation: "(no location)",
  },
  ne: {
    nav: "पहुँच",
    title: "पृष्ठ पहुँच",
    description: "verifiedNepal मा पृष्ठ हेराइ र भ्रमणको आफ्नै गणना।",
    viewsToday: "आजका पृष्ठ हेराइ",
    viewsLast30: "पछिल्लो ३० दिनका पृष्ठ हेराइ",
    visitsLast30: "पछिल्लो ३० दिनका भ्रमण",
    viewsAllTime: "हालसम्मका पृष्ठ हेराइ",
    last30Days: "पछिल्लो ३० दिन",
    views: "पृष्ठ हेराइ",
    sessions: "भ्रमण",
    dropCenters: "सङ्कलन केन्द्र",
    floodImpact: "बाढीको प्रभाव",
    last30: "पछिल्लो ३० दिन",
    allTime: "हालसम्म",
    topPaths: "शीर्ष पृष्ठ मार्गहरू",
    path: "मार्ग",
    allPages: "सबै पृष्ठ",
    page: "पृष्ठ",
    referrers: "सन्दर्भ दिने साइटहरू",
    host: "होस्ट",
    visits: "भ्रमण",
    languages: "भाषाहरू",
    language: "भाषा",
    english: "अंग्रेजी",
    nepali: "नेपाली",
    loading: "पहुँच तथ्याङ्क लोड हुँदै…",
    empty: "अहिलेसम्म पृष्ठ पहुँचको तथ्याङ्क छैन।",
    noPaths: "अहिलेसम्म कुनै मार्ग गणना भएको छैन।",
    noLocation: "(स्थान छैन)",
  },
};
