import { labels } from "@/i18n";
import { formStrings } from "@/i18n/forms";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader, SectionHeader } from "@/components/page-header";
import type { Language } from "@/lib/types";

const effectiveDate = "30 August 2026";

const draftEn = "Draft — pending owner review";
const draftNe = "मस्यौदा — सञ्चालक समीक्षा बाँकी";

type Section = { title: string; body: string[] };

const enSections: Section[] = [
  {
    title: "1. Who operates this site",
    body: [
      'verifiedNepal is a non-commercial, volunteer project maintained by a single private individual (the "Maintainer"). It is not a government website and is not affiliated with, endorsed by, or operated on behalf of the Government of Nepal, the National Disaster Risk Reduction and Management Authority (NDRRMA), or any other authority. It exists to make verified disaster-response and community-recovery information easier to read during the 2026 Rasuwa flash flood response, for a Nepal audience. The governing law is the law of Nepal, including the Individual Privacy Act, 2075 (2018).',
    ],
  },
  {
    title: "2. Acceptance of these Terms",
    body: [
      'This page is both the site\'s Terms of Service and its Privacy Policy (together, the "Terms"). By accessing or using this site you accept these Terms in full. If you do not agree with any part of them, do not use the site.',
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
    title: "4. What we collect",
    body: [
      "We collect only what you or a moderator submits to operate matching, verification, and community writing:",
      "• Needs (get-help): beneficiary name, optional phone, district, ward, household size, category and description; registrant name and phone when you register on behalf of someone else (with their consent); language. Turnstile token if enabled for abuse prevention.",
      "• Offers (give-help): helper display name, phone, optional organisation name and contact, districts and categories you can help with, and description.",
      "• Projects (community infrastructure): title and description, type, district/ward/location text, cost estimate, committee name, contact person and phone, bank and digital-wallet details. Photos and updates you attach are stored as submitted.",
      "• Articles: title, block content, cover and media sources/captions, author display name, place, tags (up to 3), and language. Writing requires a Google sign-in; the author's email is the email on that Google account and is kept private. Sign-in session data lives in your browser's session storage / local storage; no other cookies are set.",
      "• Helper, article-author and moderator sign-in: Google sign-in via the OnlyUtils auth service. The auth service verifies your identity and the site stores only the session token and the profile returned (email, name, role).",
      "We set no analytics trackers, no advertising trackers, and no cookies beyond sign-in session storage. Your language, selected district, and whether you dismissed the emergency banner are stored locally in your browser and never leave your device.",
    ],
  },
  {
    title: "5. Why we collect it",
    body: [
      "Matching help: to match people who need help with people who offer it, and to publish masked needs so the community can see what is required without exposing private contact details.",
      "Verification: moderators review every submission before publication, check for duplicates, and verify committee contacts by phone where applicable before bank details ever become public.",
      "Distribution audit ledger: when a need is fulfilled, a masked ledger entry (name, category, district, ward, date) is kept as a public audit record so relief distribution can be audited without exposing household or phone data.",
    ],
  },
  {
    title: "6. What is public and what is never public — by design",
    body: [
      "Public on the site: masked name (e.g., R. Gurung), district and ward-level location only, category, description (for needs and projects), and for articles the published title, excerpt/body, display name, place, cover/media credits and tags. For projects, committee bank and wallet details become public only after moderator verification of the committee, by design.",
      "Never public: phone numbers, registrant identity and contact, household size and household details, the Google account email used by an article author, and any private contact for offers. Phones, account emails and registrant/household information are visible only to moderators and are never shown on public boards, ledger, or article pages.",
      "Nothing you type into the Find a Person search leaves your browser: searching is performed locally against the mirrored dataset.",
    ],
  },
  {
    title: "7. Retention",
    body: [
      "Needs expire after 30 days unless you renew them with your reference code. Expired needs are removed from public boards and are not used for matching.",
      "Ledger entries are retained as a permanent public audit record, but only in masked form (no phones, no registrant details). Articles, projects, and offers that are published remain public until archived or removed for cause; rejected items are retained for audit but not published.",
      "Moderation and audit records are retained to account for every publish, reject, match and redemption decision.",
    ],
  },
  {
    title: "8. Who can see private data",
    body: [
      "Private details (phones, registrant information, household details, and the Google account email attached to an article) are visible only to moderators who sign in via OnlyUtils. Moderators are bound by written guidelines: they use private data only to verify, match and fulfil requests, never share it outside the desk, and redact it before any public display.",
      "Every moderation action — publish, reject, verify, match, fulfil, redeem — creates an AUDIT item that records who acted, when, and why, so the history can be reviewed.",
    ],
  },
  {
    title: "9. Your rights — correction and removal",
    body: [
      "You have the right under the Individual Privacy Act, 2075 to request correction or removal of your personal data held for needs, offers, projects, or articles.",
      "Contact: verifiednepal01@gmail.com. Include your reference code or article/project ID and what to correct or remove. We target a response within 7 days.",
      "For the mirrored NDRRMA rescue and missing-person lists, corrections must be made at the official source; once the source updates, the mirror reflects it at the next sync. We will still handle courtesy takedown requests for the mirrored copy.",
    ],
  },
  {
    title: "10. Consent for registering someone else",
    body: [
      "If you register a need for someone else, you must have their informed consent to share their name, location and needs description for matching and publication in masked form. Do not register a person who has not agreed, and do not include sensitive data they have not allowed us to hold. Moderators will reject on-behalf submissions where consent is not confirmed.",
    ],
  },
  {
    title: "11. Moderator accountability",
    body: [
      "Moderators act under least-privilege access via OnlyUtils sign-in and are accountable for every action through the audit ledger. They must verify committee contacts by phone before any bank details are published, mask all private fields, and follow the desk guidelines for duplicate checks and flags. Audit logs are regularly reviewed and access can be revoked.",
    ],
  },
  {
    title: "12. Money — the site never handles money",
    body: [
      "This site never collects, holds, transfers or disburses money. For community projects, payments go directly from supporters to the verified committee's own bank account or wallet after moderator verification. We do not take fees, we do not hold funds in escrow, and we do not see your transaction. Always verify bank details on the published project page before you send anything.",
      "For the 2026 flood, monetary donations should be made only through the Government of Nepal's official Prime Minister Disaster Relief Fund gateway linked on this site, not through any individual.",
    ],
  },
  {
    title: "13. Cookies, sign-in storage and trackers",
    body: [
      "No analytics trackers. No advertising. No cookies beyond sign-in session storage: the OnlyUtils sign-in stores a session token in your browser so you stay signed in as a helper or moderator until it expires. Clearing your browser storage signs you out.",
      "We store only three small preferences locally — language, selected district, and whether you dismissed the emergency banner — and they never leave your device. The site sets no third-party tracking cookies.",
    ],
  },
  {
    title: "14. Third-party services and links",
    body: [
      "Like almost every website, this site depends on third-party infrastructure that may process your IP address and standard request metadata under their own privacy policies: hosting and content delivery (Cloudflare Pages), map imagery tiles (Esri/ArcGIS Online), the OnlyUtils auth service for Google sign-in, and the optional chat assistant. If you use the chat assistant, the messages you send it are processed by the third-party AI service that operates it — do not include sensitive personal information in chat messages. The Maintainer does not control and is not responsible for the data practices of these providers.",
      "The site links to external websites (government agencies, relief organisations, the official donation gateway). Those sites are governed by their own terms and privacy policies, and the Maintainer is not responsible for their content or practices. In particular, make donations only after independently verifying the official channel.",
    ],
  },
  {
    title: "15. Permitted and prohibited use",
    body: [
      "You may use this site for personal, humanitarian, and other lawful informational purposes, and you may share links to it freely.",
      "You must not: (a) use the site for any unlawful purpose; (b) present the site, or content taken from it, as an official or government source; (c) use any record shown here to harass, intimidate, defraud, or endanger any listed person or their family; (d) redistribute mirrored records stripped of their source attribution; (e) use site content to solicit donations to any channel other than the official ones the site links to; or (f) interfere with, overload, or attempt to disrupt the operation of the site. The Maintainer may block or restrict access that violates these Terms.",
    ],
  },
  {
    title: "16. Intellectual property",
    body: [
      "The mirrored records remain the property of their originating sources. Map imagery, boundary, and river data belong to the providers credited on the map (Esri/Maxar, dataofsandy/Nepal-GEOJSON, OpenStreetMap under ODbL). Article and project content remains the author's, licensed to the site for non-commercial publication. Article authors sign in with Google, and the email on that account remains private. The site's own design, text, and code are the work of the Maintainer. You are granted a limited, revocable, non-exclusive licence to view the site and to share its content for lawful, non-commercial purposes with source attribution preserved; no other rights are granted.",
    ],
  },
  {
    title: "17. No warranty; verify with official sources",
    body: [
      'This site and its content are provided "as is" and "as available", without warranty of any kind, express or implied, including warranties of accuracy, completeness, timeliness, merchantability, or fitness for a particular purpose. Disaster data changes rapidly; mirrored data may be delayed, incomplete, or wrong. The absence of a person from any list is not evidence of their safety or of harm.',
      "This site must not be relied upon for emergency decisions. For rescue, medical, or safety needs, always contact the official authorities first: NEOC disaster hotline 1234, Nepal Police 100, Ambulance 102, and verify records on the official NDRRMA pages linked throughout the site.",
    ],
  },
  {
    title: "18. Limitation of liability",
    body: [
      "To the maximum extent permitted by applicable law, the Maintainer shall not be liable for any direct, indirect, incidental, consequential, special, exemplary, or punitive damages, or for any loss of any kind — including personal injury, loss of life, emotional distress, or financial loss — arising out of or in connection with (a) the use of, or inability to use, this site; (b) any reliance on any information displayed on it; (c) any error, omission, delay, or inaccuracy in mirrored or contributed data; or (d) the acts or omissions of any third party, including the originating data sources and the service providers named above.",
      "Because every NDRRMA data point identifies its originating official source, any claim concerning the substance of an official record lies against that source, not against this site or the Maintainer. You use this site entirely at your own risk. If any part of this section is held unenforceable, the Maintainer's aggregate liability shall in no event exceed the amount you paid to use this site, which is zero.",
    ],
  },
  {
    title: "19. Availability and termination",
    body: [
      "This is a volunteer-run service offered free of charge. The Maintainer does not guarantee that the site will be available, uninterrupted, or error-free, and may modify, suspend, or discontinue it — in whole or in part, temporarily or permanently — at any time without notice and without liability.",
    ],
  },
  {
    title: "20. Children",
    body: [
      "The site may hold needs concerning minors only when an adult registers them with consent and when that information is necessary for relief matching. Private details of minors are never made public and are visible only to moderators under the same safeguards as all private data. Records concerning minors that appear in the mirrored NDRRMA data originate from the attributed official source.",
    ],
  },
  {
    title: "21. Governing law",
    body: [
      "These Terms and any dispute arising from the use of this site are governed by the laws of Nepal, including the Individual Privacy Act, 2075 (2018) and the Electronic Transactions Act, and are subject to the exclusive jurisdiction of the courts of Nepal.",
    ],
  },
  {
    title: "22. Severability and entire agreement",
    body: [
      "If any provision of these Terms is held invalid or unenforceable, that provision shall be enforced to the maximum extent permissible and the remaining provisions shall remain in full force. These Terms constitute the entire agreement between you and the Maintainer regarding the site. A failure to enforce any provision is not a waiver of it.",
    ],
  },
  {
    title: "23. Changes and contact",
    body: [
      `These Terms may be updated at any time; the version published on this page is the current one, and continued use of the site after an update constitutes acceptance. Effective date: ${effectiveDate}. For questions, corrections, removal requests or takedown requests regarding submissions or the mirrored copy, contact: verifiednepal01@gmail.com (target response 7 days). For the underlying NDRRMA records, contact the attributed official source.`,
    ],
  },
];

const neSections: Section[] = [
  {
    title: "१. यो साइट कसले चलाउँछ",
    body: [
      "verifiedNepal एक गैर-व्यावसायिक, स्वयंसेवी परियोजना हो जुन एक निजी व्यक्ति (“सञ्चालक”) ले चलाउनु भएको छ। यो सरकारी वेबसाइट होइन र नेपाल सरकार, राष्ट्रिय विपद् जोखिम न्यूनीकरण तथा व्यवस्थापन प्राधिकरण (NDRRMA) वा अन्य कुनै निकायसँग आबद्ध, समर्थित वा तिनका तर्फबाट सञ्चालित होइन। यो २०२६ रसुवा आकस्मिक बाढीका बेला प्रमाणित सूचना पढ्न सजिलो बनाउन नेपालका पाठकका लागि बनाइएको हो। लागू कानून नेपालको कानून हो, व्यक्तिगत गोपनीयता ऐन २०७५ सहित।",
    ],
  },
  {
    title: "२. सर्त स्वीकार",
    body: [
      "यो पृष्ठ नै प्रयोगका सर्त र गोपनीयता नीति हो (सँगै “सर्तहरू”)। यो साइट प्रयोग गरेसँगै तपाईं यी सर्तहरू पूरा स्वीकार गर्नुहुन्छ। सर्तमा सहमत हुनुहुन्न भने साइट प्रयोग नगर्नुहोस्।",
    ],
  },
  {
    title: "३. देखाइएको तथ्यांक तेस्रो स्रोतबाट लिइएको हो",
    body: [
      "यहाँ देखिने ठूलो तथ्यांक — उद्धार/बेपत्ता व्यक्तिका गणना, स्थिति, स्थान — आधिकारिक सार्वजनिक स्रोत, मुख्यतः NDRRMA को सार्वजनिक डेटाबाट जस्ताको तस्तै लिइएको हो। प्रत्येक बिन्दुमा स्रोत उल्लेख छ।",
      "सञ्चालकले यी रेकर्ड सिर्जना, प्रमाणीकरण, सम्पादन वा थप गर्दैनन्। यो त ती स्रोतले प्रकाशित गरेको डेटाको प्रदर्शन तह मात्र हो; शुद्धता, वैधता, पूर्णता र समयको जिम्मा मूल स्रोतको हुन्छ। सच्याउने वा हटाउने अनुरोध सम्बन्धित स्रोतमा पठाउनुहोस्; स्रोत सच्याएपछि मिरर अर्को सिंकमा अपडेट हुन्छ। सञ्चालकले मिरर प्रतिका लागि सद्भावपूर्ण हटाउने अनुरोध पनि विचार गर्नुहुनेछ।",
    ],
  },
  {
    title: "४. हामी के सङ्कलन गर्छौं",
    body: [
      "हामी मिलान, प्रमाणीकरण र सामुदायिक लेखनका लागि आवश्यक विवरण मात्र लिन्छौं:",
      "• आवश्यकता (get-help): लाभग्राहीको नाम, वैकल्पिक फोन, जिल्ला/वडा, परिवार संख्या, श्रेणी र विवरण; अरूका लागि दर्ता गर्दा (उनीहरूको सहमतिमा) दर्ता गर्ने व्यक्तिको नाम/फोन र भाषा। दुरुपयोग रोक्न Turnstile टोकन (कन्फिगर भएमा)।",
      "• सहयोग प्रस्ताव (give-help): सहयोगीको नाम, फोन, वैकल्पिक संस्थाको नाम/सम्पर्क, सहयोग गर्न सक्ने जिल्ला/श्रेणी र विवरण।",
      "• परियोजना: शीर्षक/विवरण, प्रकार, जिल्ला/वडा/स्थान, लागत अनुमान, समितिको नाम, सम्पर्क व्यक्ति/फोन, बैंक र वालेट विवरण। जोडिएका तस्बिर/अपडेट पेश गरिएकै रूपमा भण्डारण हुन्छ।",
      "• डिस्प्याच (लेख): शीर्षक, ब्लक सामग्री, कभर र मिडियाका स्रोत/क्याप्सन, लेखकको देखिने नाम, ठाउँ, ट्याग (३ सम्म) र भाषा। लेख लेख्न Google साइन-इन आवश्यक हुन्छ; लेखकको इमेल त्यही Google खाताको इमेल हो र निजी राखिन्छ। साइन-इन सत्र डेटा तपाईंको ब्राउजरको session storage / local storage मा रहन्छ; अरू कुनै कुकी छैन।",
      "• सहयोगी, लेख-लेखक/सम्पादक र मोडरेटर साइन-इन: OnlyUtils प्रमाणीकरण सेवा मार्फत Google साइन-इन। साइटले सत्र टोकन र प्राप्त प्रोफाइल (इमेल, नाम, भूमिका) मात्र राख्छ।",
      "हामी कुनै एनालिटिक्स वा विज्ञापन ट्र्याकर राख्दैनौं, र साइन-इन सत्रभन्दा बाहेक कुनै कुकी छैन। भाषा, रोजेको जिल्ला र आपतकालीन ब्यानर हटाएको अवस्था तपाईंको ब्राउजरमा मात्र रहन्छ, बाहिर जाँदैन।",
    ],
  },
  {
    title: "५. किन सङ्कलन गर्छौं",
    body: [
      "सहयोग मिलाउन: आवश्यकता र प्रस्ताव जोड्न, र समुदायले के चाहिएको छ भनेर मास्क गरिएको सूची सार्वजनिक देखाउन।",
      "प्रमाणीकरण: प्रत्येक पेशी प्रकाशनअघि सम्पादकले जाँच गर्छन्, दोहोरो जाँच गर्छन्, र बैंक विवरण सार्वजनिक गर्नुअघि समितिलाई फोन गरेर प्रमाणित गर्छन्।",
      "वितरण अडिट लेजर: आवश्यकता पूरा भएको प्रमाणका लागि मास्क गरिएको लेजर (नाम, श्रेणी, जिल्ला, वडा, मिति) सार्वजनिक राखिन्छ, ताकि राहत वितरण लेखापरीक्षण गर्न सकियोस् तर निजी विवरण नखुलोस्।",
    ],
  },
  {
    title: "६. के सार्वजनिक हुन्छ, के कहिल्यै हुँदैन",
    body: [
      "सार्वजनिक: मास्क गरिएको नाम (जस्तै R. Gurung), जिल्ला र वडा-स्तरको स्थान मात्र, श्रेणी, विवरण (आवश्यकता/परियोजनाका लागि) र लेख प्रकाशनमा शीर्षक, अंश/मूलपाठ, देखिने नाम, ठाउँ, कभर/मिडिया स्रोत र ट्याग। परियोजनामा समितिको बैंक/वालेट विवरण सम्पादकले समिति प्रमाणित गरेपछि मात्र सार्वजनिक हुन्छ — डिजाइन नै त्यस्तै हो।",
      "कहिल्यै सार्वजनिक हुँदैन: फोन नम्बर, दर्ता गर्ने व्यक्तिको पहिचान/सम्पर्क, परिवार संख्या/विवरण, लेख-लेखकले प्रयोग गरेको Google खाताको इमेल, प्रस्तावको निजी सम्पर्क। फोन, खाता इमेल र दर्ता/परिवार विवरण केवल सम्पादकले मात्र देख्छन् र कहिल्यै सार्वजनिक बोर्ड, लेजर वा लेख पृष्ठमा देखिँदैन।",
      "व्यक्ति खोज बक्समा टाइप गरेको कुरा तपाईंको ब्राउजरबाट बाहिर जाँदैन: खोज मिरर डेटासेटमा स्थानीय रूपमा हुन्छ।",
    ],
  },
  {
    title: "७. भण्डारण अवधि",
    body: [
      "आवश्यकता ३० दिनपछि म्याद सकिन्छ, तपाईंले सन्दर्भ कोडले नवीकरण नगरेसम्म। म्याद सकिएको सूची सार्वजनिक बोर्डबाट हट्छ र मिलानमा प्रयोग हुँदैन।",
      "लेजर प्रविष्टि मास्क गरिएको सार्वजनिक अडिट रेकर्डका रूपमा स्थायी राखिन्छ (फोन/दर्ता विवरण बिना)। प्रकाशित लेख, परियोजना र प्रस्ताव पुराना नभएसम्म वा कारणले हटाइएसम्म सार्वजनिक रहन्छन्; अस्वीकृत सामग्री अडिटका लागि राखिन्छ तर प्रकाशित हुँदैन।",
      "हरेक प्रकाशन/अस्वीकार/मिलान/रिडिमको अडिट रेकर्ड राखिन्छ।",
    ],
  },
  {
    title: "८. निजी डेटा कसले देख्न सक्छ",
    body: [
      "निजी विवरण (फोन, दर्ता जानकारी, परिवार विवरण र लेखसँग जोडिएको Google खाताको इमेल) OnlyUtils मार्फत साइन-इन गरेका सम्पादकले मात्र देख्न सक्छन्। सम्पादक लिखित निर्देशिकामा बाँधिएका छन्: प्रमाणीकरण/मिलान/पूरा गर्न मात्र प्रयोग गर्ने, डेस्क बाहिर साझा नगर्ने, र प्रकाशनअघि निजी फिल्ड हटाउने।",
      "हरेक सम्पादन कार्य — प्रकाशन, अस्वीकार, प्रमाणीकरण, मिलान, पूरा, रिडिम — AUDIT वस्तुका रूपमा कसले, कहिले, किन भन्ने विवरणसहित लेखिन्छ।",
    ],
  },
  {
    title: "९. तपाईंका अधिकार — सच्याउने र हटाउने",
    body: [
      "व्यक्तिगत गोपनीयता ऐन २०७५ बमोजिम तपाईंले आवश्यकता/प्रस्ताव/परियोजना/लेखमा रहेको आफ्नो व्यक्तिगत डेटा सच्याउन वा हटाउन अनुरोध गर्न सक्नुहुन्छ।",
      "सम्पर्क: verifiednepal01@gmail.com । सन्दर्भ कोड वा लेख/परियोजना ID र के सच्याउने/हटाउने भन्ने खुलाउनुहोस्। हामी ७ दिनभित्र जवाफ दिने लक्ष्य राख्छौं।",
      "NDRRMA को उद्धार/बेपत्ता मिरर सूचीका लागि आधिकारिक स्रोतमा नै सच्याउनुपर्छ; स्रोत अपडेट भएपछि मिरर अर्को सिंकमा मिल्छ। मिरर प्रतिका लागि सद्भावपूर्ण हटाउने अनुरोध पनि हामी हेर्छौं।",
    ],
  },
  {
    title: "१०. अरूका लागि दर्ता गर्दा सहमति",
    body: [
      "अरूका लागि आवश्यकता दर्ता गर्दा उनीहरूको जानकारी — नाम, स्थान, आवश्यकता विवरण — मास्क गरिएको रूपमा प्रकाशन र मिलानका लागि साझा गर्न उनीहरूको सूचित सहमति अनिवार्य छ। सहमति नभएको व्यक्ति दर्ता नगर्नुहोस् र उनीहरूले अनुमति नदिएको संवेदनशील डेटा नथप्नुहोस्। सहमति पुष्टि नभएका पेशी सम्पादकले अस्वीकार गर्नुहुनेछ।",
    ],
  },
  {
    title: "११. सम्पादक उत्तरदायित्व",
    body: [
      "सम्पादकले OnlyUtils साइन-इन मार्फत न्यूनतम अधिकारमा काम गर्छन् र हरेक कार्य अडिट लेजरमा लेखिन्छ। बैंक विवरण सार्वजनिक गर्नुअघि समितिलाई फोन गरेर प्रमाणित गर्नुपर्छ, निजी फिल्ड मास्क गर्नुपर्छ, र दोहोरो/झण्डा जाँच निर्देशिका पालना गर्नुपर्छ। अडिट लग नियमित समीक्षा हुन्छ र पहुँच खोस्न सकिन्छ।",
    ],
  },
  {
    title: "१२. पैसा — यो साइटले कहिल्यै पैसा चलाउँदैन",
    body: [
      "यो साइटले कहिल्यै पैसा सङ्कलन, धारण, स्थानान्तरण वा वितरण गर्दैन। समुदाय परियोजनामा सहयोग सिधै समर्थकले प्रमाणित समितिको आफ्नै बैंक खाता/वालेटमा पठाउँछ, सम्पादक प्रमाणीकरणपछि। हामी शुल्क लिँदैनौं, एस्क्रोमा राख्दैनौं, र कारोबार देख्दैनौं। पैसा पठाउनुअघि प्रकाशित पृष्ठको बैंक विवरण आफैं प्रमाणित गर्नुहोस्।",
      "२०२६ बाढीका लागि मौद्रिक दान केवल यहाँ जोडिएको नेपाल सरकारको प्रधानमन्त्री दैवी प्रकोप राहत कोषको आधिकारिक गेटवे मार्फत मात्र गर्नुहोस्।",
    ],
  },
  {
    title: "१३. कुकी, साइन-इन भण्डारण र ट्र्याकर",
    body: [
      "कुनै एनालिटिक्स ट्र्याकर छैन, कुनै विज्ञापन छैन। साइन-इन सत्र भण्डारणभन्दा बाहेक कुनै कुकी छैन: OnlyUtils साइन-इनले तपाईंको ब्राउजरमा सत्र टोकन राख्छ ताकि सहयोगी/सम्पादक म्याद सकिएसम्म साइन-इन रहोस्। ब्राउजर स्टोरेज खाली गरेपछि साइन-आउट हुन्छ।",
      "हामी स्थानीय रूपमा केवल तीन सानो प्राथमिकता राख्छौं — भाषा, रोजेको जिल्ला, र आपतकालीन ब्यानर हटाएको अवस्था — र त्यो बाहिर जाँदैन। तेस्रो-पक्ष ट्र्याकिङ कुकी छैन।",
    ],
  },
  {
    title: "१४. तेस्रो-पक्ष सेवा र लिङ्क",
    body: [
      "हरेक वेबसाइट जस्तै हामी पूर्वाधारका लागि तेस्रो पक्षमा भर पर्छौं, जसले तपाईंको IP र सामान्य अनुरोध मेटाडाटा आफ्नै नीति अनुसार प्रशोधन गर्न सक्छ: होस्टिङ/डेलिभरी (Cloudflare Pages), नक्सा टायल (Esri/ArcGIS Online), साइन-इनका लागि OnlyUtils, र वैकल्पिक च्याट सहायक। च्याट प्रयोग गर्दा तपाईंले पठाएको सन्देश सम्बन्धित AI सेवाले प्रशोधन गर्छ — संवेदनशील व्यक्तिगत विवरण च्याटमा नलेख्नुहोस्। सञ्चालकले तिनको डेटा अभ्यास नियन्त्रण गर्दैन।",
      "साइटले बाह्य वेबसाइट (सरकारी निकाय, राहत संस्था, आधिकारिक दान गेटवे) मा लिङ्क गर्छ। तिनका नियम/नीति तिनैको हुन्छ, सञ्चालक जिम्मेवार हुँदैन। विशेष गरी दान आधिकारिक च्यानल प्रमाणित गरेर मात्र गर्नुहोस्।",
    ],
  },
  {
    title: "१५. प्रयोगको अनुमति र निषेध",
    body: [
      "तपाईंले व्यक्तिगत, मानवीय र अन्य वैध सूचनात्मक प्रयोजनका लागि साइट प्रयोग र लिङ्क साझा गर्न सक्नुहुन्छ।",
      "तपाईंले गर्न नहुने: (क) गैरकानुनी प्रयोजन; (ख) साइट वा सामग्रीलाई सरकारी/आधिकारिक स्रोत जस्तो देखाउने; (ग) यहाँका रेकर्डले कुनै व्यक्ति/परिवारलाई हानी/ठगी/दुःख दिने; (घ) स्रोत उल्लेख हटाएर मिरर रेकर्ड पुनः बाँड्ने; (ङ) यहाँ जोडिएको बाहेक अन्य च्यानलमा दान माग्ने; (च) साइटमा बाधा/अतिभार/हस्तक्षेप गर्ने। सञ्चालकले उल्लङ्घन गर्ने पहुँच रोक्न सक्नुहुन्छ।",
    ],
  },
  {
    title: "१६. बौद्धिक सम्पत्ति",
    body: [
      "मिरर रेकर्ड मूल स्रोतकै सम्पत्ति रहन्छ। नक्सा छवि/सीमा/नदी डेटा नक्सामा श्रेय दिइएका प्रदायक (Esri/Maxar, dataofsandy/Nepal-GEOJSON, OpenStreetMap ODbL) को हो। लेख/परियोजनाको सामग्री लेखककै हुन्छ, गैर-व्यावसायिक प्रकाशनका लागि साइटलाई इजाजत दिइएको मानिन्छ। लेखका लेखक Google बाट साइन-इन गर्छन् र त्यही खाताको इमेल निजी रहन्छ। साइटको डिजाइन/लेख/कोड सञ्चालकको हो। स्रोत उल्लेखसहित हेर्ने र वैध गैर-व्यावसायिक साझा गर्ने सीमित इजाजत दिइन्छ; अरू अधिकार छैन।",
    ],
  },
  {
    title: "१७. वारेन्टी छैन; आधिकारिक स्रोतमा पुष्टि गर्नुहोस्",
    body: [
      "साइट र सामग्री “जस्तो छ, उपलब्ध भएजस्तो” दिइन्छ, कुनै पनि किसिमको वारेन्टी बिना — शुद्धता, पूर्णता, समय, बिक्रीयोग्यता वा कुनै उद्देश्यका लागि उपयुक्तताको वारेन्टी छैन। विपद् डेटा छिटो बदलिन्छ; मिरर ढिलो, अपूर्ण वा गलत हुन सक्छ। कुनै सूचीमा नाम नहुनु सुरक्षा वा हानिको प्रमाण होइन।",
      "आपतकालीन निर्णयका लागि यो साइटमा भर नपर्नुहोस्। उद्धार, स्वास्थ्य वा सुरक्षाका लागि सधैं आधिकारिक निकायमा सम्पर्क गर्नुहोस्: NEOC हटलाइन १२३४, प्रहरी १००, एम्बुलेन्स १०२, र आधिकारिक NDRRMA पृष्ठमा रेकर्ड पुष्टि गर्नुहोस्।",
    ],
  },
  {
    title: "१८. दायित्वको सीमा",
    body: [
      "लागू कानूनले दिने अधिकतम हदसम्म सञ्चालक कुनै प्रत्यक्ष, अप्रत्यक्ष, आकस्मिक, परिणामस्वरूप, विशेष, उदाहरणीय वा दण्डात्मक क्षति वा कुनै पनि किसिमको हानि — शारीरिक चोट, ज्यानको हानि, मानसिक पीडा वा आर्थिक घाटा — को लागि जिम्मेवार हुनुहुने छैन, चाहे (क) साइट प्रयोग/प्रयोग गर्न नसक्नु; (ख) जानकारीमा भर पर्नु; (ग) मिरर वा योगदान गरिएको डेटामा त्रुटि/ढिलाइ/अशुद्धता; वा (घ) मूल स्रोत र माथि उल्लेखित सेवा प्रदायक लगायत तेस्रो पक्षको काम/अकर्मसँग सम्बन्धित होस्।",
      "हरेक NDRRMA बिन्दुले मूल स्रोत खुलाउँछ, त्यसैले आधिकारिक रेकर्डको सार सम्बन्धी दाबी त्यस स्रोतप्रति लाग्छ, यो साइट वा सञ्चालकप्रति होइन। साइट पूर्ण रूपमा तपाईंको जोखिममा प्रयोग गर्नुहुन्छ। कुनै भाग लागु नहुने ठहरिए सञ्चालकको कुल दायित्व तपाईंले साइट प्रयोगका लागि तिरेको रकमभन्दा बढि हुनेछैन, जुन शून्य हो।",
    ],
  },
  {
    title: "१९. उपलब्धता र समाप्ति",
    body: [
      "यो स्वयंसेवी, निःशुल्क सेवा हो। साइट उपलब्ध, निर्बाध वा त्रुटिरहित हुने ग्यारेन्टी छैन, र सञ्चालकले कुनै पनि बेला सूचना बिना आंशिक वा पूर्ण रूपमा परिवर्तन, निलम्बन वा बन्द गर्न सक्नुहुन्छ, दायित्व बिना।",
    ],
  },
  {
    title: "२०. बालबालिका",
    body: [
      "नाबालिग सम्बन्धी आवश्यकता वयस्कले सहमतिमा र राहत मिलानका लागि आवश्यक हुँदा मात्र दर्ता गर्न सकिन्छ। नाबालिगको निजी विवरण कहिल्यै सार्वजनिक हुँदैन र अन्य निजी डेटा जस्तै सम्पादकले मात्र देख्न सक्छन्। मिररमा देखिने नाबालिग सम्बन्धी रेकर्ड मूल आधिकारिक स्रोतबाट आउँछ।",
    ],
  },
  {
    title: "२१. लागू कानून",
    body: [
      "यी सर्त र साइट प्रयोगबाट उत्पन्न हुने कुनै पनि विवाद नेपालको कानून — व्यक्तिगत गोपनीयता ऐन २०७५ र विद्युतीय कारोबार ऐन बमोजिम — शासित हुनेछ र नेपालका अदालतको विशेष क्षेत्राधिकारमा रहनेछ।",
    ],
  },
  {
    title: "२२. विभाज्यता र समग्र सम्झौता",
    body: [
      "कुनै प्रावधान अमान्य वा लागू नहुने ठहरिए पनि त्यो अधिकतम सम्भव हदसम्म लागू हुनेछ र बाँकी प्रावधान यथावत रहनेछ। यी सर्तहरू यो साइट सम्बन्धी तपाईं र सञ्चालकबीचको सम्पूर्ण सम्झौता हुन्। कुनै प्रावधान लागू नगरिनु त्यसको त्याग होइन।",
    ],
  },
  {
    title: "२३. परिवर्तन र सम्पर्क",
    body: [
      `यी सर्त कुनै पनि बेला अद्यावधिक हुन सक्छन्; यस पृष्ठमा प्रकाशित संस्करण नै हालको हो, र अद्यावधिकपछि साइट प्रयोग जारी राख्नु स्वीकृति मानिन्छ। लागू मिति: ${effectiveDate}। पेशी वा मिरर प्रतिका प्रश्न/सच्याउने/हटाउने अनुरोधका लागि सम्पर्क: verifiednepal01@gmail.com (लक्ष्य जवाफ ७ दिन)। NDRRMA रेकर्डका लागि सम्बन्धित आधिकारिक स्रोतमा सम्पर्क गर्नुहोस्।`,
    ],
  },
];

const nepaliSummaryHonest = [
  "यो साइट एक व्यक्तिले स्वयंसेवी रूपमा चलाउनु भएको हो; नेपाल सरकार वा NDRRMA सँग आबद्ध छैन। यहाँको उद्धार/बेपत्ता तथ्यांक NDRRMA बाट जस्ताको तस्तै लिइएको हो र हरेक बिन्दुमा स्रोत खुलाइएको छ।",
  "हामी आवश्यकता, सहयोग प्रस्ताव, परियोजना र लेखमा तपाईंले दिने विवरण (नाम, जिल्ला/वडा, विवरण, कभर/मिडिया स्रोत र OnlyUtils मार्फत Google साइन-इन) मात्र लिन्छौं। लेख-लेखकको इमेल Google खाताबाट आउँछ र निजी रहन्छ। कुनै एनालिटिक्स/विज्ञापन ट्र्याकर छैन, साइन-इन सत्रबाहेक कुनै कुकी छैन।",
  "सार्वजनिकमा मास्क गरिएको नाम र वडा-स्तरको स्थान मात्र देखिन्छ; फोन, दर्ता गर्नेको विवरण र परिवार जानकारी कहिल्यै सार्वजनिक हुँदैन। परियोजनाको बैंक विवरण समिति फोनबाट प्रमाणित भएपछि मात्र देखिन्छ।",
  "आवश्यकता ३० दिनपछि म्याद सकिन्छ (नवीकरण नगरे हट्छ); लेजर मास्क गरिएको सार्वजनिक अडिट रेकर्डका रूपमा रहन्छ। निजी डेटा सम्पादकले मात्र देख्छन् र हरेक कार्य अडिट-लग हुन्छ।",
  "आफ्नो डेटा सच्याउन/हटाउन verifiednepal01@gmail.com मा सम्पर्क गर्नुहोस् — लक्ष्य ७ दिन। अरूका लागि दर्ता गर्दा उनीहरूको सहमति अनिवार्य छ। यो साइटले कहिल्यै पैसा चलाउँदैन। लागू कानून: व्यक्तिगत गोपनीयता ऐन २०७५।",
  "कानुनी रूपमा अंग्रेजी पाठ आधिकारिक हो, तर यहाँ दिइएको नेपाली विवरणले नै व्यवहार निर्धारण गर्छ।",
];

export function PrivacyPolicy({ language }: { language: Language }) {
  const t = labels[language];
  const ts = formStrings[language];
  const sections = language === "ne" ? neSections : enSections;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Alert role="note" className="border-warning bg-warning-soft text-warning">
        <AlertDescription>
          <span className="font-semibold">
            {draftEn} · <span lang="ne">{draftNe}</span>
          </span>
          <br />
          {language === "ne"
            ? "यो नीति अझै मस्यौदा हो र सञ्चालकको अन्तिम समीक्षा बाँकी छ — अन्तिम मान्नु अघि पुष्टि गर्नुहोस्।"
            : "This policy is a draft pending the owner's final review — do not treat it as the final published version."}
        </AlertDescription>
      </Alert>
      <PageHeader eyebrow={ts.privacyEyebrow} title={t.privacyTitle} description={`${t.effectiveDate}: ${effectiveDate}`} />
      <article className="space-y-8 text-base leading-relaxed text-foreground">
        <p className="border-l-2 border-primary pl-4 text-muted-foreground">
          {language === "ne"
            ? "सञ्चालक: एक निजी स्वयंसेवी (Maintainer)। लागू कानून: नेपालको व्यक्तिगत गोपनीयता ऐन, २०७५। सम्पर्क: verifiednepal01@gmail.com।"
            : "Maintainer: a single private volunteer. Governing law: Nepal, Individual Privacy Act, 2075. Contact: verifiednepal01@gmail.com."}
        </p>
        {sections.map((section) => (
          <section key={section.title} className="space-y-3">
            <SectionHeader title={section.title} />
            {section.body.map((paragraph) =>
              paragraph.startsWith("• ") ? (
                <ul key={paragraph} className="list-disc space-y-2 pl-5">
                  <li>{paragraph.slice(2)}</li>
                </ul>
              ) : (
                <p key={paragraph}>{paragraph}</p>
              ),
            )}
          </section>
        ))}
      </article>
      <aside lang="ne" className="border-t pt-8">
        <SectionHeader title={t.neSummaryTitle} />
        <div className="mt-4 space-y-3 text-base leading-relaxed text-muted-foreground">
          {nepaliSummaryHonest.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          {draftNe} — {draftEn}
        </p>
      </aside>
    </div>
  );
}
