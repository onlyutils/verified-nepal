import type { Language } from "@/lib/types";

export const needTimelineStrings = {
  en: {
    timeline: "Need timeline",
    taken: "Taken",
    declared: "Goods declared",
    received: "Goods received",
    handed_over: "Handed over",
    confirmed: "Confirmed",
  },
  ne: {
    timeline: "आवश्यकताको समयरेखा",
    taken: "लिइयो",
    declared: "सामान घोषणा भयो",
    received: "सामान प्राप्त भयो",
    handed_over: "हस्तान्तरण भयो",
    confirmed: "पुष्टि भयो",
  },
} satisfies Record<Language, Record<string, string>>;
