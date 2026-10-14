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
  },
};
