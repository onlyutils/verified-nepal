import type { Language } from "@/lib/types";

export const turnstileStrings = {
  en: {
    label: "Verification",
    completeHint: "Complete the verification above to continue",
    expiredError: "Verification expired or failed — please complete the check again.",
    loadError: "Verification couldn't load — check your connection and reload.",
  },
  ne: {
    label: "प्रमाणीकरण",
    completeHint: "जारी राख्न माथिको प्रमाणीकरण पूरा गर्नुहोस्",
    expiredError: "प्रमाणीकरणको समय सकियो वा असफल भयो — कृपया जाँच फेरि पूरा गर्नुहोस्।",
    loadError: "प्रमाणीकरण लोड हुन सकेन — आफ्नो जडान जाँचेर फेरि लोड गर्नुहोस्।",
  },
} satisfies Record<Language, Record<string, string>>;
