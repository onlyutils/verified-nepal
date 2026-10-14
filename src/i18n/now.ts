import type { Language } from "@/lib/types";

export const nowStrings: Record<
  Language,
  {
    officialSource: string;
    checked: string;
    checkedTooltip: string;
    delivered: string;
    standingFloodImpact: string;
    standingLedger: string;
    nowTitle: string;
    nowEmpty: string;
    nowSeeAll: string;
    nowNoUpdates: string;
    loading: string;
    opmcm: string;
    deliverySource: string;
    moderator: string;
    ward: string;
    readUpdate: string;
    showBody: string;
    hideBody: string;
    whatsapp: string;
    viber: string;
    copy: string;
    copied: string;
    copyFailed: string;
    languageEn: string;
    languageNe: string;
  }
> = {
  en: {
    officialSource: "Official source",
    checked: "Checked",
    checkedTooltip: "A moderator other than the author confirmed this item names a source, a place and a date.",
    delivered: "Delivered",
    standingFloodImpact: "Flood impact explorer",
    standingLedger: "Relief ledger",
    nowTitle: "Now",
    nowEmpty: "Nothing new since {time}",
    nowSeeAll: "See all",
    nowNoUpdates: "No updates yet",
    loading: "Loading updates…",
    opmcm: "Prime Minister’s Office",
    deliverySource: "Relief ledger",
    moderator: "Moderator",
    ward: "Ward {ward}",
    readUpdate: "Read the update",
    showBody: "Show full text",
    hideBody: "Show less",
    whatsapp: "WhatsApp",
    viber: "Viber",
    copy: "Copy",
    copied: "Copied",
    copyFailed: "Could not copy. Use WhatsApp or Viber to share.",
    languageEn: "EN",
    languageNe: "ने",
  },
  ne: {
    officialSource: "आधिकारिक स्रोत",
    checked: "जाँच गरिएको",
    checkedTooltip: "लेखकबाहेक अर्को समीक्षकले यस सामग्रीमा स्रोत, स्थान र मिति उल्लेख भएको जाँच गरेका छन्।",
    delivered: "पुर्‍याइयो",
    standingFloodImpact: "बाढीको प्रभाव हेर्नुहोस्",
    standingLedger: "राहतको हिसाबकिताब",
    nowTitle: "अहिले",
    nowEmpty: "{time} देखि कुनै नयाँ जानकारी छैन",
    nowSeeAll: "सबै हेर्नुहोस्",
    nowNoUpdates: "अहिलेसम्म कुनै जानकारी आएको छैन",
    loading: "जानकारी लोड हुँदै छ…",
    opmcm: "प्रधानमन्त्री कार्यालय",
    deliverySource: "राहतको हिसाबकिताब",
    moderator: "समीक्षक",
    ward: "वडा {ward}",
    readUpdate: "जानकारी पढ्नुहोस्",
    showBody: "पूरा विवरण हेर्नुहोस्",
    hideBody: "छोटकरीमा हेर्नुहोस्",
    whatsapp: "WhatsApp",
    viber: "Viber",
    copy: "कपी गर्नुहोस्",
    copied: "कपी भयो",
    copyFailed: "कपी गर्न सकिएन। साझा गर्न WhatsApp वा Viber प्रयोग गर्नुहोस्।",
    languageEn: "EN",
    languageNe: "ने",
  },
};
