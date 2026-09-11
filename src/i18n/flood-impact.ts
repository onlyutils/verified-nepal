import type { Language } from "@/lib/types";

const en = {
  navLabel: "Flood impact",
  homeCtaEyebrow: "Satellite view · Trishuli flash flood",
  homeCtaHeadline: "See the corridor before and after",
  homeCtaBody: "Satellite photographs of the Langtang Lirung glacier collapse and the flash flood it triggered down the Trishuli River — before and after, location by location.",
  homeCtaButton: "View the flood impact",
  pageTitle: "Trishuli flood — before and after",
  eyebrow: "26 August 2026 · Langtang Lirung glacier collapse",
  lead: "Satellite imagery of the Trishuli River corridor before and after the flash flood, from Rasuwagadhi down through Trishuli Bazaar and Devighat.",
  play: "Play",
  pause: "Pause",
  before: "Before",
  after: "After",
  showClassification: "Highlight the flooded area",
  timelapseHeading: "The corridor over time",
  timelapseCaption: "Weekly composite timelapse",
  notPublished: "This visualization isn't published yet.",
  loadError: "Couldn't load the flood imagery. Please try again later.",
  noClearImagery: "No cloud-free satellite photographs of the corridor are available yet.",
  imageryCredit: "Satellite photographs: Copernicus Sentinel-2. Map imagery: Esri, Maxar, Earthstar Geographics.",
  imageError: "Image unavailable",
} satisfies Record<string, string>;

const ne: typeof en = {
  navLabel: "बाढी प्रभाव",
  homeCtaEyebrow: "स्याटेलाइट दृश्य · त्रिशूली बाढी",
  homeCtaHeadline: "अघि र पछि नदी करिडोर हेर्नुहोस्",
  homeCtaBody: "लाङटाङ लिरुङ हिमनदी भत्किएर त्रिशूली नदीमा आएको बाढीको स्याटेलाइट तस्बिर — अघि र पछि, ठाउँ-ठाउँमा।",
  homeCtaButton: "बाढी प्रभाव हेर्नुहोस्",
  pageTitle: "त्रिशूली बाढी — अघि र पछि",
  eyebrow: "२६ अगस्ट २०२६ · लाङटाङ लिरुङ हिमनदी विपद्",
  lead: "रसुवागढीदेखि त्रिशूली बजार हुँदै देविघाटसम्म त्रिशूली नदी करिडोरको बाढी अघि र पछिको स्याटेलाइट तस्बिर।",
  play: "प्ले",
  pause: "रोक्नुहोस्",
  before: "अघि",
  after: "पछि",
  showClassification: "बाढी फैलिएको क्षेत्र देखाउनुहोस्",
  timelapseHeading: "समयसँगै करिडोर",
  timelapseCaption: "साप्ताहिक कम्पोजिट टाइमल्याप्स",
  notPublished: "यो दृश्यावलोकन अझै प्रकाशित भएको छैन।",
  loadError: "बाढीको तस्बिर लोड गर्न सकिएन। पछि फेरि प्रयास गर्नुहोस्।",
  noClearImagery: "करिडोरको बादलरहित स्याटेलाइट तस्बिर अझै उपलब्ध छैन।",
  imageryCredit: "स्याटेलाइट तस्बिर: कोपरनिकस सेन्टिनल-२। नक्सा तस्बिर: Esri, Maxar, Earthstar Geographics।",
  imageError: "तस्बिर उपलब्ध छैन",
};

export const floodImpactStrings: Record<Language, typeof en> = { en, ne };
