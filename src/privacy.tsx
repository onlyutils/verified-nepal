import { labels } from "./i18n";
import type { Language } from "./types";

/**
 * ponytail: one combined Privacy & Terms page — policy text lives here as
 * plain data, English is the governing text with a Nepali key-points summary;
 * add a full Nepali translation only if users ask for one.
 */

const effectiveDate = "30 August 2026";

const nepaliSummary = [
  "यो साइट एक व्यक्तिले स्वयंसेवी रूपमा चलाएको हो; यो नेपाल सरकार वा NDRRMA सँग आबद्ध छैन।",
  "यहाँ देखिने उद्धार/बेपत्ता सम्बन्धी सबै तथ्यांक आधिकारिक सार्वजनिक स्रोत (NDRRMA) बाट जस्ताको तस्तै लिइएको हो र प्रत्येक तथ्यांकमा स्रोत उल्लेख गरिएको छ। तथ्यांकको शुद्धता वा त्यसमा आधारित निर्णयको जिम्मेवारी यो साइट वा यसका सञ्चालकले लिँदैन।",
  "साइटले तपाईंको कुनै व्यक्तिगत विवरण सङ्कलन गर्दैन, कुनै एनालिटिक्स वा विज्ञापन छैन। भाषा र क्षेत्र छनोट तपाईंकै ब्राउजरमा मात्र रहन्छ।",
  "साइटको दुरुपयोग निषेध छ: यसलाई आधिकारिक/सरकारी साइट जस्तो देखाउन, सूचीमा रहेका व्यक्ति वा परिवारलाई दुःख दिन वा ठगी गर्न पाइँदैन।",
  "आपतकालीन निर्णयका लागि सधैं आधिकारिक निकाय (हटलाइन १२३४, प्रहरी १००, एम्बुलेन्स १०२) मा भर पर्नुहोस्।",
  "कानुनी रूपमा तलको अंग्रेजी पाठ आधिकारिक हो।",
];

const sections: Array<{ title: string; body: string[] }> = [
  {
    title: "1. Who operates this site",
    body: [
      "verifiedNepal is a non-commercial, volunteer project maintained by a single private individual (the \"Maintainer\"). It is not a government website and is not affiliated with, endorsed by, or operated on behalf of the Government of Nepal, the National Disaster Risk Reduction and Management Authority (NDRRMA), or any other authority. It exists solely to make already-public disaster response information easier to read during the 2026 Rasuwa flash flood response.",
    ],
  },
  {
    title: "2. Acceptance of these Terms",
    body: [
      "This page is both the site's Terms of Service and its Privacy Policy (together, the \"Terms\"). By accessing or using this site you accept these Terms in full. If you do not agree with any part of them, do not use the site.",
    ],
  },
  {
    title: "3. Data displayed on this site is third-party sourced",
    body: [
      "All substantive content on this site — including counts, statuses, locations, and records concerning rescued or missing persons — is mirrored from official public sources, principally the NDRRMA's public rescue data. The originating source is identified on every data point and every record shown on this site.",
      "The Maintainer does not create, verify, edit, supplement, or curate these records. The site is a display layer over data published by the attributed source, and responsibility for the accuracy, lawfulness, completeness, and timeliness of that data rests solely with the originating source. Requests to correct or remove a record should be directed to the attributed source; once the source updates its data, the mirror reflects the change at the next sync. The Maintainer will additionally consider good-faith takedown requests for the mirrored copy as a courtesy.",
    ],
  },
  {
    title: "4. Information collected from visitors",
    body: [
      "The Maintainer collects no personal information from visitors. The site has no user accounts, no registration, no analytics operated by the Maintainer, no advertising, and no sale or sharing of visitor data. Nothing you type into the person search leaves your browser: searching is performed locally against the mirrored dataset.",
      "The site stores small preferences (your language choice, a selected district, and whether you dismissed the emergency banner) in your own browser's local storage. This data never leaves your device and can be cleared at any time through your browser settings. The site sets no tracking cookies.",
    ],
  },
  {
    title: "5. Third-party services",
    body: [
      "Like almost every website, this site depends on third-party infrastructure that may process your IP address and standard request metadata under their own privacy policies: hosting and content delivery (Cloudflare Pages), map imagery tiles (Esri/ArcGIS Online), and the optional chat assistant. If you use the chat assistant, the messages you send it are processed by the third-party AI service that operates it — do not include sensitive personal information in chat messages. The Maintainer does not control and is not responsible for the data practices of these providers.",
    ],
  },
  {
    title: "6. Permitted and prohibited use",
    body: [
      "You may use this site for personal, humanitarian, and other lawful informational purposes, and you may share links to it freely.",
      "You must not: (a) use the site for any unlawful purpose; (b) present the site, or content taken from it, as an official or government source; (c) use any record shown here to harass, intimidate, defraud, or endanger any listed person or their family; (d) redistribute mirrored records stripped of their source attribution; (e) use site content to solicit donations to any channel other than the official ones the site links to; or (f) interfere with, overload, or attempt to disrupt the operation of the site. The Maintainer may block or restrict access that violates these Terms.",
    ],
  },
  {
    title: "7. Intellectual property",
    body: [
      "The mirrored records remain the property of their originating sources. Map imagery, boundary, and river data belong to the providers credited on the map (Esri/Maxar, dataofsandy/Nepal-GEOJSON, OpenStreetMap under ODbL). The site's own design, text, and code are the work of the Maintainer. You are granted a limited, revocable, non-exclusive licence to view the site and to share its content for lawful, non-commercial purposes with source attribution preserved; no other rights are granted.",
    ],
  },
  {
    title: "8. No warranty; verify with official sources",
    body: [
      "This site and its content are provided \"as is\" and \"as available\", without warranty of any kind, express or implied, including warranties of accuracy, completeness, timeliness, merchantability, or fitness for a particular purpose. Disaster data changes rapidly; mirrored data may be delayed, incomplete, or wrong. The absence of a person from any list is not evidence of their safety or of harm.",
      "This site must not be relied upon for emergency decisions. For rescue, medical, or safety needs, always contact the official authorities first: NEOC disaster hotline 1234, Nepal Police 100, Ambulance 102, and verify records on the official NDRRMA pages linked throughout the site.",
    ],
  },
  {
    title: "9. Limitation of liability",
    body: [
      "To the maximum extent permitted by applicable law, the Maintainer shall not be liable for any direct, indirect, incidental, consequential, special, exemplary, or punitive damages, or for any loss of any kind — including personal injury, loss of life, emotional distress, or financial loss — arising out of or in connection with (a) the use of, or inability to use, this site; (b) any reliance on any information displayed on it; (c) any error, omission, delay, or inaccuracy in mirrored data; or (d) the acts or omissions of any third party, including the originating data sources and the service providers named above.",
      "Because every data point on this site identifies its originating official source, any claim concerning the substance of a record lies against that source, not against this site or the Maintainer. You use this site entirely at your own risk. If any part of this section is held unenforceable, the Maintainer's aggregate liability shall in no event exceed the amount you paid to use this site, which is zero.",
    ],
  },
  {
    title: "10. Third-party links",
    body: [
      "The site links to external websites (government agencies, relief organisations, the official donation gateway). Those sites are governed by their own terms and privacy policies, and the Maintainer is not responsible for their content or practices. In particular, make donations only after independently verifying the official channel.",
    ],
  },
  {
    title: "11. Availability and termination",
    body: [
      "This is a volunteer-run service offered free of charge. The Maintainer does not guarantee that the site will be available, uninterrupted, or error-free, and may modify, suspend, or discontinue it — in whole or in part, temporarily or permanently — at any time without notice and without liability.",
    ],
  },
  {
    title: "12. Children",
    body: [
      "The site collects no personal data from anyone, including children. Records concerning minors that appear in the mirrored data originate from the attributed official source.",
    ],
  },
  {
    title: "13. Governing law",
    body: [
      "These Terms and any dispute arising from the use of this site are governed by the laws of Nepal, including the Individual Privacy Act, 2075 (2018), and are subject to the exclusive jurisdiction of the courts of Nepal.",
    ],
  },
  {
    title: "14. Severability and entire agreement",
    body: [
      "If any provision of these Terms is held invalid or unenforceable, that provision shall be enforced to the maximum extent permissible and the remaining provisions shall remain in full force. These Terms constitute the entire agreement between you and the Maintainer regarding the site. A failure to enforce any provision is not a waiver of it.",
    ],
  },
  {
    title: "15. Changes and contact",
    body: [
      `These Terms may be updated at any time; the version published on this page is the current one, and continued use of the site after an update constitutes acceptance. Effective date: ${effectiveDate}. For questions, corrections, or takedown requests regarding the mirrored copy, contact the Maintainer through the links in the site footer; for the underlying records, contact the attributed official source.`,
    ],
  },
];

export function PrivacyPolicy({ language }: { language: Language }) {
  const t = labels[language];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="border border-nepal-line bg-white p-6 shadow-panel sm:p-8">
        <h1 className="text-3xl font-bold tracking-display text-nepal-ink">{t.privacyTitle}</h1>
        <p className="mt-2 text-sm text-nepal-slate">
          {language === "ne" ? "प्रभावकारी मिति" : "Effective date"}: {effectiveDate}
        </p>
        {language === "ne" ? (
          <div className="mt-5 border-l-4 border-nepal-blue bg-nepal-blueSoft p-4 text-sm leading-6 text-nepal-ink">
            <p className="font-bold">मुख्य बुँदाहरू</p>
            {nepaliSummary.map((line) => (
              <p key={line} className="mt-2">
                {line}
              </p>
            ))}
          </div>
        ) : null}
        <div className="mt-6 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-bold tracking-display text-nepal-ink">{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="mt-2 leading-7 text-nepal-slate">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
