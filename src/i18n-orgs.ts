import type { Language } from "./types";

// Strings for organization registration and the organization dashboard.
export const orgStrings = {
  en: {
    registerOrgTitle: "Register an organization",
    registerOrgCta: "Register organization",
    orgDashboardTitle: "My organization",
    navMyOrg: "My organization",
  },
  ne: {
    registerOrgTitle: "संस्था दर्ता गर्नुहोस्",
    registerOrgCta: "संस्था दर्ता",
    orgDashboardTitle: "मेरो संस्था",
    navMyOrg: "मेरो संस्था",
  },
} satisfies Record<Language, Record<string, string>>;
