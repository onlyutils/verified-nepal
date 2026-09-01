import type { Language } from "./types";

// Strings for the public drop-center directory and detail page.
export const centerStrings = {
  en: {
    dropCentersTitle: "Drop centers",
    navDropCenters: "Drop centers",
    unverifiedOrg: "Unverified organization",
  },
  ne: {
    dropCentersTitle: "सामग्री सङ्कलन केन्द्रहरू",
    navDropCenters: "सङ्कलन केन्द्र",
    unverifiedOrg: "प्रमाणित नभएको संस्था",
  },
} satisfies Record<Language, Record<string, string>>;
