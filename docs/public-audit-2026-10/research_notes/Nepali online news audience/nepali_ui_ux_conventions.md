# Nepali-market UI/UX conventions, constraints and best practices (news and information sites, 2022–2026)

Research date: 2026-10-14. Items marked **[measured]** were observed directly by the researcher on 2026-10-14 (live HTML/CSS of the named sites, Google Fonts CSS API, Node 22 Intl); the URL given is the thing measured, not a write-up. Items marked **[not Nepal-specific]** are general Devanagari/Hindi guidance.

## 1. Devanagari web typography

### Takeaway
The de-facto font stack of the big Nepali portals is Mukta (Setopati, Ratopati) or a Google Devanagari face plus Inter for Latin (Onlinekhabar, Kathmandu Post); eKantipur uses the serif Martel. A single Devanagari weight costs 38–62 KB woff2 (Hind lightest, Mukta heaviest), so two weights plus Latin is roughly 100–150 KB; body copy should run ~17–18 px with ~1.7–1.8 line-height, never letter-spaced inside words, and conjuncts (क्ष, ज्ञ, ह्यारी-type ligatures) are the first thing to break on cheap Android phones. Preeti/Kantipur-era legacy content must be converted to Unicode before it is searchable or screen-readable.

### Cited Findings
**Fonts in actual use on Nepali news sites [measured 2026-10-14]**
- Setopati article pages load `Mukta:wght@400;700` from Google Fonts — [setopati.com article](https://www.setopati.com/politics/400783)
- Ratopati loads `Mukta:wght@400;500;600;700;800;900` (six weights) — [ratopati.com story](https://www.ratopati.com/story/599484)
- eKantipur loads the serif `Martel:wght@200;300;400;600;700;800;900` and declares `font-family: "Martel", serif !important` — [ekantipur.com article](https://ekantipur.com/news/2026/10/13/how-safe-are-nepals-hydropower-ambitions-in-the-changing-himalayas-49-57.html)
- Onlinekhabar loads the variable `Inter` from Google Fonts (Latin) and declares no Google Devanagari face in the HTML (Devanagari face is presumably self-hosted or system); Kathmandu Post (English) uses `Inter:wght@100..900` — [onlinekhabar.com article](https://www.onlinekhabar.com/2026/10/2038284/starting-with-venus-setting-why-is-it-considered-forbidden-to-do-auspicious-work-at-this-time); [kathmandupost.com](https://kathmandupost.com/)

**Font loading cost (Google Fonts woff2 subsets, Chrome-Android UA) [measured 2026-10-14 via https://fonts.googleapis.com/css2]**
- Devanagari subset (U+0900–097F etc.) per weight: Noto Sans Devanagari 400 = 50,408 B; 700 = 53,832 B; Noto Serif Devanagari 400 = 50,944 B; Mukta 400 = 61,928 B; Hind 400 = 38,072 B; Poppins 400 (Devanagari subset) = 39,504 B; Yantramanav 400 = 19,916 B. The accompanying latin + latin-ext subsets add roughly 12–21 KB per weight (e.g. Noto Sans Devanagari 400: 10,540 + 6,396 B; Mukta 400: 13,500 + 8,116 B). — [Google Fonts CSS2 API](https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400&display=swap)
- Implication from the measurement: Ratopati's six Mukta weights are ~370 KB of Devanagari woff2 before any Latin subset; Setopati's two weights are ~124 KB.
- Vendor guidance (Nepali web agency, not peer-reviewed): "Load only the weights you use. Devanagari weights are heavier than Latin ones because of conjunct glyphs"; use `font-display: swap` so visitors see fallback text instead of blank space, and `preload` the one Devanagari body weight; subset to needed glyphs if Nepali content is limited to menus/taglines — [WebsNP, Nepali Unicode and Devanagari Typography on the Web](https://www.websnp.com/help/nepali-unicode-fonts-website-typography)

**Recommended fonts, sizes, spacing**
- WebsNP (Nepali agency): Noto Sans Devanagari as "Google's workhorse" default for body; Mukta designed to pair with Latin, good for headings and body; Hind compact for dense UI (menus, buttons); Poppins or Inter for the English portion of bilingual sites. Body size "usually 17 to 18 pixels, versus 16 pixels for English"; line-height "about 1.7 to 1.8 for Devanagari, versus 1.5 for English"; avoid tight letter-spacing because it "breaks the shirorekha"; use bold sparingly because heavy weights "look muddy on low-end phone screens"; test on a cheap Android phone — [WebsNP](https://www.websnp.com/help/nepali-unicode-fonts-website-typography)
- **[not Nepal-specific]** W3C Indic Layout Requirements (Working Draft, 29 May 2020): where letter-spacing is applied, "the space needs to be introduced after each syllable for correct representation"; a line must not begin with danda (।), double danda (॥), comma or full stop; no breaks inside numeric strings like "10,000" or "12:59"; hyphenation at orthographic-syllable boundaries; Nepali is listed as a Devanagari language with a different collation order from Hindi. The draft explicitly does not cover line-height, justification, emphasis or numerals. — [W3C ilreq](https://www.w3.org/TR/ilreq/)

**Conjunct / ligature rendering**
- WebsNP: rendering of conjuncts "differs across Windows, Android, and iOS"; क्ष and ज्ञ "break first when a font stack is faulty" and should be the first thing checked — [WebsNP](https://www.websnp.com/help/nepali-unicode-fonts-website-typography)
- Nepali spelling of "Harry" shows ligature variation in the wild: online usage typically uses the ligatured ह्यारी while a published translation uses हयारी — [Potterglot, Harry Potter and the Nepali Spelling](https://www.potterglot.net/harry-potter-and-the-nepali-spelling/)
- **[not Nepal-specific]** Devanagari rendering depends on which Devanagari font the device vendor shipped (Mozilla bug 992100) and on characters missing from a Samsung device font (bug 1012365); a Marathi conjunct beginning with ल rendered wrongly in Chrome and Firefox on Windows but correctly on Linux (Wikimedia T303789) — [Bugzilla 1018897](https://bugzilla.mozilla.org/show_bug.cgi?id=1018897); [Bugzilla 1012365](https://bugzilla.mozilla.org/show_bug.cgi?id=1012365); [Wikimedia Phabricator T303789](https://phabricator.wikimedia.org/T303789)
- DoIT portal audit found "poor rendering of the Nepal Sambat script" as a perceptual barrier (this refers to Nepal Sambat/Nepal Bhasa script content, not Devanagari Nepali) — [Internet Society: DoIT accessibility audit](https://news.internetsociety.org/?p=37907)

**Preeti legacy-font problem and Unicode conversion**
- Preeti, Kantipur and Himali fonts store Roman ASCII that only looks like Devanagari when the font is installed; search engines and screen readers cannot process it; convert with a Preeti-to-Unicode converter before publishing; "half of 'font problems' are actually database encoding problems" (declare UTF-8 and use utf8mb4) — [WebsNP](https://www.websnp.com/help/nepali-unicode-fonts-website-typography)
- Conversion pitfalls: Preeti types the i-matra (ि) before the consonant whereas Unicode encodes it after; conjuncts such as क्ष need multi-character matching because visual order differs from logical order — [NepaliFontConverter (NuGet)](https://www.nuget.org/packages/NepaliFontConverter); overview of converter method — [Edusanjal, how Preeti Unicode converter works](https://edusanjal.com/blog/how-preeti-unicode-converter-works/)
- Open-source converters exist: npm `preeti` (FOSS Nepal code, also handles PCS Nepali and Kantipur) — [npm preeti](https://npmjs.org/package/preeti); GitHub topic listing — [github.com/topics/preeti-to-unicode](https://github.com/topics/preeti-to-unicode)
- Google's Republic Day doodle and NPS brand guidelines are listed under Trust signals (section 8).

**Numerals, bold/italic**
- Node 22 ICU `ne-NP` formatting uses Devanagari digits by default and lakh/crore grouping: `१,२३,४५,६७८.९`; `-u-nu-latn` yields `2026 अक्टोबर 14`; `ne-NP` currency renders as `नेरू १२,३४,५६७.००` — **[measured, Node v22.18.0 Intl]**
- Statcounter-visible portals differ in digit convention: Setopati and eKantipur show the header date in Devanagari digits ("बुधबार, असोज २८, २०८३" / "२८ आश्विन २०८३, बुधबार"); Onlinekhabar uses Devanagari digits in relative times ("४५ सेकेन्ड अगाडि", "११ घण्टा अगाडि") while eKantipur's "ताजा समाचार" list also shows ISO Gregorian dates "2026-10-14" in Latin digits — [setopati.com](https://www.setopati.com/); [ekantipur.com](https://ekantipur.com/); [onlinekhabar.com](https://www.onlinekhabar.com/)
- Mukta on Google Fonts is served in 400–900 weights (Ratopati loads all six); Noto Sans Devanagari has 400 and 700 subsets of near-identical size (50.4 vs 53.8 KB) — **[measured]** [Google Fonts CSS2](https://fonts.googleapis.com/css2?family=Mukta:wght@400;500;600;700;800;900)

### Inferences
- Mukta is the closest thing to a "house font" of Nepali online news; a new site using Mukta 400/700 will look native to readers of Setopati/Ratopati. Noto Sans Devanagari is the safer fallback for conjunct coverage but visually slightly denser.
- Budget: two Devanagari weights + Inter Latin ~150 KB woff2 is the realistic floor; six weights (Ratopati pattern) is over 350 KB and should be avoided on 4 GB-RAM budget phones.
- Because true italic Devanagari is essentially absent from these Google families (no italic axis was served for Mukta, Hind, Noto Sans Devanagari in the CSS responses), emphasis should be done with weight or colour, not `<em>` italics, which browsers will synthesise as slanted glyphs. (This is an inference from the served CSS, not a documented claim.)

### Gaps
- No Nepal-specific study of FOUT/FOIT perception or of line-height preferences was found; the 17–18 px / 1.7–1.8 figures come from a single commercial agency article.
- No confirmed Chromium issue specifically about Nepali conjuncts on Android Chrome was found; the rendering-bug evidence is Hindi/Marathi and Firefox-centred.
- Could not determine Onlinekhabar's Devanagari webfont (not declared via Google Fonts in page HTML).

## 2. Dates, time and numbers

### Takeaway
Nepali-language portals lead with Bikram Sambat in Devanagari digits in the masthead (Setopati "बुधबार, असोज २८, २०८३"; eKantipur "२८ आश्विन २०८३, बुधबार") while URLs and machine metadata stay Gregorian; teasers increasingly use relative time ("११ घण्टा अगाडि") instead of a "प्रकाशित:" stamp. ICU/Intl has no Bikram Sambat calendar, so BS display needs a library; lakh/crore grouping (१,२३,४५,६७८) and the नेरू/रु currency symbol are what `ne-NP` produces by default. Nepal time is UTC+05:45.

### Cited Findings
- Setopati header: "बुधबार, असोज २८, २०८३" (BS, Devanagari digits, weekday first); no AD date in header; footer "© 2026" in AD — [setopati.com](https://www.setopati.com/) **[measured]**
- eKantipur header: "२८ आश्विन २०८३, बुधबार" (note Sanskritised month name आश्विन vs Setopati's colloquial असोज); AD only in URLs (`/2026/10/14/`) and in the "ताजा समाचार" list as "2026-10-14"; weather/AQI widget in Nepali digits ("काठमाडौंमा वायुको गुणस्तर: १२४") — [ekantipur.com](https://ekantipur.com/) **[measured]**
- Onlinekhabar homepage shows no absolute date; teasers use relative Nepali-digit times ("४५ सेकेन्ड अगाडि", "११ घण्टा अगाडि"); URLs Gregorian `/2026/10/` — [onlinekhabar.com](https://www.onlinekhabar.com/) **[measured]**
- Article-level "प्रकाशित" labels were not found in server-rendered HTML of Onlinekhabar, eKantipur, Ratopati or Setopati articles (likely rendered client-side) — **[measured, negative result]**
- WordPress plugin "Indesign Nepali Post Date" converts publish/modified dates to BS, supports Nepali or English numerals, targets Nepali news portals, and claims Press Council regulations as a reason to show BS dates (vendor claim, unverified); supported range BS 2000–2101 — [WordPress plugin page](https://ja.wordpress.org/plugins/indesign-nepali-post-date/)
- `Intl.supportedValuesOf("calendar")` in Node 22 contains `indian` (Saka) but no Bikram Sambat/Vikram calendar; `Asia/Kathmandu` offset is GMT+05:45 — **[measured, Node v22.18.0]**
- ICU `ne-NP` default: `१,२३,४५,६७८.९` (lakh/crore grouping, Devanagari digits); currency `नेरू १२,३४,५६७.००`; full date `२०२६ अक्टोबर १४, बुधबार: ०८:२२` — **[measured]**
- Hamro Patro, the dominant Nepali calendar app, has been installed more than 10 million times (2018 figure) — [NepaliTelecom, top 10 Nepali apps 2018](https://www.nepalitelecom.com/2018/11/top-10-popular-nepali-apps-2018.html)
- Nepal's 2021 census published final data in March 2022 (useful as an example of government releases that are dated in both calendars in news coverage) — [Aawaaj News](https://aawaajnews.com/?p=16333)

### Inferences
- Readers of Nepali-language news expect the BS date (Devanagari digits) to be visible and primary; AD is tolerated in URLs/metadata. An English edition (Kathmandu Post, Onlinekhabar English) uses AD only.
- Month naming is a style choice (असोज vs आश्विन); Setopati's colloquial form is more "spoken", eKantipur's is formal/print-paper tradition.
- Relative timestamps ("… अगाडि") plus a BS absolute date on the article page is the pattern that satisfies both habits and `datePublished` SEO needs.

### Gaps
- No Press Council or Department of Information rule mandating BS date display on portals was found; the only claim is from a plugin vendor.
- No reader-preference study (BS vs AD, Devanagari vs Latin digits) was found.

## 3. Language switching, input and search

### Takeaway
Major Nepali outlets run English as a separate property rather than a per-article toggle: eKantipur lists Kathmandu Post under "हाम्रा अन्य प्रकाशनहरु", Setopati links a small "EN" to en.setopati.com, Onlinekhabar links "English edition"/"EN" to its English subdomain. Input is dominated by Romanized transliteration keyboards (Hamro Nepali Keyboard offers Unicode-transliteration, MPP Romanized and traditional layouts), and Devanagari search must normalise spelling variants (ह्रस्व/दीर्घ, nukta, ligatured vs unligatured forms, loanword transliterations) because standards bodies deliberately refuse to define Nepali spelling norms.

### Cited Findings
- eKantipur homepage has no English-edition link; Kathmandu Post is listed as a separate publication under "हाम्रा अन्य प्रकाशनहरु"; English UI strings ("Subscribe Now", "Sign In", "Featured Stories", "23 MINS READ") are mixed into the Nepali page — [ekantipur.com](https://ekantipur.com/) **[measured]**
- Setopati: "EN" marker beside "English" linking to en.setopati.com (title attribute misspelled "Enlish Edition") — [setopati.com](https://www.setopati.com/) **[measured]**
- Onlinekhabar: "English edition" and "EN" links to the English subdomain — [onlinekhabar.com](https://www.onlinekhabar.com/) **[measured]**
- A Nepal-targeted marketing article recommends a toggle that keeps the reader on the same article rather than redirecting to the homepage (low-credibility SEO agency, no data) — [dev.to, 7 key features for Nepali news sites](https://dev.to/seo_esignature_8b18cc8801/what-makes-a-news-website-work-in-nepal-7-key-features-for-2025-20na)
- Hamro Nepali Keyboard "support[s] three keyboard layouts, Unicode Transliteration, MPP based Romanized layout, and traditional layout", plus Preeti and Ganesh font layouts; Romanized Nepali transliterates instantly to Devanagari — [Hamro Patro, Nepali Keyboard](https://www.hamropatro.com/en/apps/nepali-keyboard); App Store rating 3.5/5 (122 ratings) — [Apple App Store](https://apps.apple.com/us/app/hamro-nepali-keyboard/id1276952753)
- "Nepali Unicode Romanized" is described as the easiest way to type on a computer; a user notes the Hamro iPhone keyboard is "hard to switch out of" (single-user account) — [BU LIS Lab, Typing in Newar](https://sites.bu.edu/lislab/2025/08/31/typing-in-newar/)
- Three major Nepali Unicode keyboard layouts exist (traditional, Romanized, and a third) — [Nepali Unicode Keyboard Layout Standardization (Academia)](https://www.academia.edu/1028724/Nepali_Unicode_Keyboard_Layout_Standarization_based_on_Genetic_Algorithm)
- ICANN's Devanagari LGR group for Nepali/Newar chose to "restrict ourselves from going in the 'spelling norms'"; "not all spelling norms are algorithmically predictable and vary a great deal across the community" — [ICANN neobrahmigp list](https://lists.icann.org/hyperkitty/list/neobrahmigp@icann.org/thread/JRROYZX6VPIMMK4SK6PI6JZ7SNFKE3L6/)
- W3C i18n reviewer: normalisation "should be expected as a given, always, before matching"; nukta encoding and visually identical but differently encoded sequences are known issues — [W3C string-search thread](https://lists.w3.org/Archives/Public/public-i18n-archive/2022JanMar/0204.html)
- **[not Nepal-specific]** loanwords have no fixed Devanagari spelling (डोमेस्टिक vs डॉमेस्टिक), so one word appears in several forms — [arXiv 2303.05046](https://arxiv.org/pdf/2303.05046)
- NEPTUN normalises Romanized Nepali by mapping to Devanagari and dictionary lookup (Romanized input, Nepali journal) — [NEPTUN (NepJOL)](https://nepjol.info/index.php/jhcoe/article/view/91508)
- Government directive expects content "in Nepali (Unicode) and, as far as possible, English" — [Republica, all govt websites made accessibility friendly](https://myrepublica.nagariknetwork.com/news/all-govt-websites-now-made-accessibility-friendly-90-67.html)

### Inferences
- A per-page EN/नेपाली toggle is uncommon among incumbents, so a site that offers it should keep the user on the same item and label the toggle "EN" / "नेपाली" (two-letter "EN" is the recognised affordance).
- Search should at minimum apply NFC normalisation, fold ि/ी and ु/ू, fold nukta, and accept Romanized Nepali input (transliterate server-side), because a large share of users type Romanized.

### Gaps
- No usage statistics for Romanized vs Unicode typing in Nepal were found.
- No Nepali-specific documentation of search-engine normalisation (e.g. Elasticsearch/Algolia for Nepali) was found.

## 4. Device and network realities

### Takeaway
Nepal is ~56% online (16.5–16.6 M users, DataReportal 2025/2026), overwhelmingly on Android and Chrome (Chrome ~79–80%, Safari ~14%); the Android install base is spread from Android 11 through 16 with only ~24% on the latest release, the budget segment (NPR 13–15k) ships 4 GB RAM, and common viewports are 360×800 and 414×896. Data is cheap by volume (Ncell 1.1 GB for Rs 50; 30 GB combos from Rs 199–599/28 days) but DataReportal notes many connections are voice/SMS-only, and operator 4G coverage claims (95% population) are self-reported.

### Cited Findings
**Users and connections**
- Start of 2025: 16.5 M internet users (55.8% penetration), 39.0 M cellular connections (132% of population), 14.3 M social-media identities (48.1%), population 29.6 M — [DataReportal Digital 2025: Nepal](https://datareportal.com/reports/digital-2025-nepal)
- End of 2025: 16.6 M internet users (56.0%), 32.4 M cellular connections (109%); DataReportal cautions some connections support only voice/SMS or lack internet — [DataReportal Digital 2026: Nepal](https://datareportal.com/reports/digital-2026-nepal); commentary that many mobile users rely mainly on voice/SMS rather than data — [NepaliTelecom on DataReportal 2026](https://www.nepalitelecom.com/2026/05/only-56-percent-use-intermet-in-nepal-sharp-reality-vs-expection-in-datareportal-figures.html)

**OS, browser, vendor, screen**
- Android version share, Nepal, June/July 2026: Android 16 ≈ 22–24%, 15 ≈ 20%, 13 ≈ 16%, 14 ≈ 12–13%, 12 ≈ 11%, 11 ≈ 9.5% — [Statcounter Android version share, Nepal](https://gs.statcounter.com/android-version-market-share/mobile/nepal)
- Browser share (desktop+mobile), June 2026: Chrome 79.73%, Safari 13.65%, Edge 2.05%, Firefox 1.54%, Brave 0.8%, Opera 0.78% (Opera Mini is not broken out) — [Statcounter browser share, Nepal](https://gs.statcounter.com/browser-market-share/desktop-mobile/nepal)
- Mobile vendor share, September 2026: Apple 25%, Samsung 21.65%, Xiaomi 21.18%, Vivo 6.92%, Oppo 5.59%, Realme 4.8% — [Statcounter vendor share, Nepal](https://gs.statcounter.com/vendor-market-share/mobile/nepal)
- Mobile screen resolutions, September 2026: 414×896 14.38%, 360×800 11.42%, 384×832 8.54%, 393×873 7.38%, 390×844 4.3%, 385×854 3.56% — [Statcounter screen resolution, Nepal](https://gs.statcounter.com/screen-resolution-stats/mobile/nepal)
- Budget phones under NPR 15,000 (2026 lists): Redmi 14C 4/128 GB NPR 13,999 (6.88" IPS, 120 Hz); Realme Note 70 4/128 NPR 14,999; OPPO A5x 4/64 NPR 14,999; Vivo Y04 4/128 NPR 14,999; Samsung Galaxy A06 4/64 NPR 15,499; Itel A80 4/128 NPR 12,990 (HD+ screen); 4 GB RAM is the segment norm — [NepaliTelecom, best phones under Rs 15,000](https://nepalitelecom.com/best-phones-under-rs-15000-in-nepal); [GadgetByte, best phones under Rs 15,000 (2026)](https://www.gadgetbytenepal.com/top-smartphones-under-rs-15000/)

**Data cost**
- Ncell "50 Data pack": 1.1 GB for Rs 50, 3 days (≈ Rs 45/GB) — [NepaliTelecom, Ncell 90 unlimited and 50 data pack](https://www.nepalitelecom.com/ncell-90-unlimited-and-50-data-pack)
- Ncell (May 2026 aggregator): 7 GB weekly Rs 299; 30+30 GB home/away 28 days Rs 599; 120 GB Rs 749; Unlimited Combo 30 GB Rs 199, 100 GB Rs 399, 200 GB Rs 699 (28 days); third-party listing, not Ncell — [PriceNepal, NTC & Ncell rates May 2026](https://pricenepal.com/ntc-ncell-data-pack-price-nepal-2026/)
- Ncell unlimited voice/data pack Rs 699 (down from Rs 1,999), 28 days — [NepaliTelecom](https://www.nepalitelecom.com/?p=105276)
- NTC all-time packs: 100 GB Rs 999 / 28 days; 30 GB Rs 299 / 28 days (undated) — [NepaliTelecom NTC data pack](https://www.nepalitelecom.com/tag/ntc-data-pack-code)

**Coverage**
- Ncell (Jan 2026, operator claim): 4G in all 77 districts and "over 95% of the country's population"; 250 towers added in 2025 — [NepaliTelecom](https://www.nepalitelecom.com/2026/01/ncell-installed-250-new-towers-in-2025-bolstering-4g-reach.html); 2023 figure 92.09% population, 6.88 M 4G subscribers (54.06% share, NTA) — [TelecomTalk](https://telecomtalk.info/?p=917495)
- Ncell 2020: 549 of 753 local levels (~73%) — [NepaliTelecom 2020](https://www.nepalitelecom.com/2020/10/ncell-4g-coverage-71-districts-900mhz-spectrum.html)
- Regional variation: "in Nepal, where internet speed varies greatly by region, a slow-loading website is a serious problem" (marketing source) — [dev.to](https://dev.to/seo_esignature_8b18cc8801/what-makes-a-news-website-work-in-nepal-7-key-features-for-2025-20na)

**Page weight of Nepali portals**
- Automated snapshots (unclear date/method): aarthiknews.com 167 requests, ~5 s to render; nepaljapan.com 6.55 s average load; osnepal.com 2.75 s response — [Accessify aarthiknews](https://www.accessify.com/a/aarthiknews.com); [Webrate nepaljapan](https://webrate.org/index.php/site/nepaljapan.com/); [Webrate osnepal](https://webrate.org/index.php/site/osnepal.com/)
- Raw HTML sizes fetched 2026-10-14 with a mobile UA: Onlinekhabar article 234 KB HTML; Ratopati story 168 KB; Setopati article 128 KB; Kathmandu Post home 118 KB; eKantipur article 60 KB; Hamro Patro homepage 1.72 MB of HTML — **[measured]** [hamropatro.com](https://www.hamropatro.com/)
- Ad clutter: Chrome extensions exist specifically to strip "intrusive animated GIF" ads from Onlinekhabar, eKantipur, Setopati and HamroPatro — [Onlinekhabar Adblocker (Chrome Web Store)](https://chrome.google.com/webstore/detail/onlinekhabar-adblocker/mlphgcnljdljnjchfbpcdcbipdomconf); [Nepali Ads Remover](https://chrome.google.com/webstore/detail/nepali-ads-remover/lpfechppbjmfpngpmealhllmnckgninl)

### Inferences
- Design for 360–414 px wide, 4 GB RAM, Android 11–16 Chrome; iOS share (Apple 25% of mobile vendors) is high enough that Safari/WebKit Devanagari rendering must be tested too.
- Per-GB cost is low (tens of rupees), so page weight matters more for latency on congested hill-district 4G than for data cost; a 1–1.5 MB first load is competitive with incumbents (Hamro Patro's 1.7 MB HTML alone is an outlier).
- Statcounter's 2026 pages are what is live; 2025 snapshots require the site's historical view.

### Gaps
- No HTTPArchive/CrUX figures specific to Nepali portals were found; no independent NTA MIS coverage-by-district table surfaced.
- No Nepal-specific research on what users consider "fast".
- Opera Mini / Chrome Lite-mode usage in Nepal not separately reported by Statcounter.

## 5. Layout conventions Nepali readers expect from news sites

### Takeaway
The three biggest Nepali-language portals share a recognisable grammar: BS date masthead, horizontal Nepali category bar (राजनीति, अर्थ, विचार, खेलकुद, मनोरञ्जन, फिचर, कभर स्टोरी, ब्लग), a lead image-card block followed by dense thumbnail+headline lists, "ताजा" / "भर्खरैको खबर" latest lists, "धेरै पढिएका" most-read, "ट्रेन्डिङ", "थप सामाग्री"/"सबै हेर्नुहोस् >>" more-links, reporter bylines, "तस्बिर : …" photo credits, interspersed Ncell/bank ads, Department of Information registration number in the footer, and a small "EN" link. Explicit scrolling tickers, "प्रकाशित:" stamps and Facebook comments plugins were not visible in the server-rendered homepages.

### Cited Findings
- Onlinekhabar nav: "होमपेज", "समाचार", "बिजनेस", "जीवनशैली", "मनोरञ्जन", "विचार", "खेलकुद", "अन्य"; subnav "ट्रेन्डिङ", "ताजा अपडेट", "२४ घण्टाका ताजा अपडेट"; blocks "कभर स्टोरी", "वेबस्टोरिज", "सप्ताहान्त", "सूचना-प्रविधि", "साहित्य", "ब्लग", "पौरखी प्रवासी", "OK रिल्स", "राशिफल"; "छुटाउनुभयो कि ?" (did you miss it) block; lead large image cards then text lists with ~150×150 / 270×170 thumbnails; comment-count icon per teaser; bylines "अनलाइनखबर" or reporter names; no visible ticker — [onlinekhabar.com](https://www.onlinekhabar.com/) **[measured]**
- Setopati nav with icons: "गृहपृष्ठ", "फिचर", "राजनीति", "बजार अर्थतन्त्र", "नेपाली ब्रान्ड", "विचार", "समाज", "कला", "ब्लग", "खेलकुद", "ग्लोबल", "कभर स्टोरी"; modules repeat label + featured + bulleted sub-headlines + "थप सामाग्री"; bylines "सुनिता सिटौला", "सेतोपाटी संवाददाता"; photo credit "तस्बिरः नारायण महर्जन/सेतोपाटी"; ad slots for Ncell, Nimb, Everest Bank; footer "सूचना विभाग दर्ता नंः १४१७/०७६-२०७७" and developer credit SoftNEP; no visible timestamps on teasers (sequential numeric story IDs) — [setopati.com](https://www.setopati.com/) **[measured]**
- eKantipur nav: "भर्खरैको खबर", "राजनीति", "अर्थ / वाणिज्य", "विचार", "खेलकुद", "मनोरञ्जन", "अन्तर्वार्ता", "फिचर", "विश्व", provinces under "Pradesh", "उपत्यका"; "धेरै पढिएका" (most read), "ताजा समाचार", daily poll "जनमतमा आजको प्रश्न", AQI/weather strip, reading-time tags "23 MINS READ", "सबै हेर्नुहोस् >>", editorials labelled "सम्पादकीय", "तस्बिर : कान्तिपुर" credits, copy-link toast "Link copied successfully", app-store links — [ekantipur.com](https://ekantipur.com/) **[measured]**
- Feature checklist from a Nepal-targeted agency (low credibility, no data): mobile-first, fast load, breaking-news ticker/bar, smart search with category/date filters, structured sections, dual-language access, non-intrusive ads — [dev.to](https://dev.to/seo_esignature_8b18cc8801/what-makes-a-news-website-work-in-nepal-7-key-features-for-2025-20na)
- Nepali online media criticised academically for clickbait and "sensationalization of the facts for the economic interests" — [TU eLibrary, Media as misleading business](https://elibrary.tucl.edu.np/items/162130f6-3f46-4b9f-a189-35a42631fd68); overview of Nepali online portals — [Bodhi journal (NepJOL)](https://www.nepjol.info/index.php/BOHDI/article/view/2876)
- Registration/ethics regime: Online Media Operation Directive 2017 (effective 20 March 2017) requires registration with the Department of Information, annual renewal, and compliance with the Press Council code of conduct; the 2016 directive with blocking powers was withdrawn after IFJ/press-union protest — [AHN Legal, online media regulation in Nepal](https://www.ahnlegal.com/legal-updates/legal/online-media-regulation-in-nepal); [Freedom Forum](https://freedomforum.org.np/regressive-move-limiting-freedom-of-expression); [IFJ](https://ifj.org/media-centre/news/detail/article/updated-nepal-introduces-repressive-directives-for-online-media)

### Inferences
- A news-style Nepali site should show a BS date masthead, Nepali category bar, "ताजा"/"धेरै पढिएका" rails, bylines with "तस्बिर :" credits and a visible DoI registration number in the footer; these are trust and familiarity cues as much as layout.
- Red headline colour could not be verified from CSS; grep of the four portals' HTML/first stylesheets for common red hex values returned nothing, so "red headlines" should be treated as unconfirmed folklore until visually checked.
- Facebook comments plugins are not part of the current incumbents' server-rendered pages; comment counts (Onlinekhabar) and a "Comments" sidebar (Setopati) are.

### Gaps
- Headline colours, sticky share bars and "प्रकाशित:" formats are rendered client-side or via CSS the text fetch did not expose; a browser screenshot pass is needed.
- No Behance/Dribbble/Medium redesign case study of Onlinekhabar or Setopati was found (search returned unrelated projects).

## 6. Accessibility and low-literacy design

### Takeaway
Nepal has the legal scaffolding (Disability Rights Act 2017 with a right to information, CRPD ratification, MoCIT 2021 website directive requiring responsive and disability-friendly sites, WCAG 2.2 AA referenced in a 2026 audit of DoIT) but poor practice: the DoIT portal failed on skip links, mouse-only menus, PDF-only content, unlabelled forms and contrast; eight health-ministry sites averaged 30 WAVE errors and 23 contrast issues each. Nepali screen-reader speech only became realistic with the open-source Dina (दिना) TTS voice (UNICEF/ATscale, 3 Dec 2024) for TalkBack/NVDA. Literacy is 76.3% (5+), so plain language, icons and audio matter.

### Cited Findings
- Dina (दिना) Nepali TTS launched 3 Dec 2024 by UNICEF and ATscale; works on Windows and Android, as a TalkBack add-on and with NVDA/SAPI-5; open source; pretested with ~15 visually impaired youths; previously TTS "mostly supported English… often mispronouncing" Nepali — [UNICEF Nepal press release](https://www.unicef.org/nepal/press-releases/unicef-and-atscale-launch-nepali-text-speech-digital-voice-dina-%E0%A4%A6%E0%A4%BF%E0%A4%A8%E0%A4%BE-enhance)
- Government site accessibility pages tell TalkBack users to install a Nepali voice and recommend Dina — [MoHA district office screen-reader page](https://daobajura.moha.gov.np/en/screen-reader)
- Hear2Read NVDA add-on adds Nepali voices; 2018 Festival-based Nepali TTS paper names screen readers as a primary use — [ISCA SLTU 2018](https://www.isca-archive.org/sltu_2018/bajracharya18_sltu.html)
- DoIT portal audit (Internet Society Nepal Chapter, Open Internet Nepal, Diverse Patterns; published ~Jan 2026): WCAG 2.2 AA benchmark; barriers include no skip links, mouse-only menus, PDF-only documents, missing alt text, inaccessible chatbot, unlabelled form fields; roadmap calls for 4.5:1 contrast, visible focus, 44×44 px touch targets, HTML-first publishing, Nepali Sign Language content, captions — [Internet Society: DoIT audit](https://news.internetsociety.org/?p=37907); companion piece — [How accessibility transformed Nepal's digital governance model](https://news.internetsociety.org/?p=37905)
- About eight ministries' websites have had accessibility audits (April 2026); persons with disabilities "deprived of information and employment due to lack of accessibility to websites and apps" — [eKantipur English, 30 Apr 2026](https://ekantipur.com/business/2026/04/30/en/people-with-disabilities-are-deprived-of-information-and-employment-due-to-lack-of-accessibility-to-websites-and-apps-52-23.html)
- Eight Nepali healthcare government homepages averaged 30.43 WAVE errors, 23.00 contrast issues, 28.00 alerts; "lack of a suitable policy environment specifically designed to promote ICT accessibility" — [Annapurna Express](https://theannapurnaexpress.com/story/54873/)
- MoCIT "Directive Related to Development and Management of Website of Government Offices, 2021": DoIT template for uniformity, hosting on Government Integrated Data Centre, responsive across mobile/tablet/desktop, accessible for persons with disabilities, Nepali and English where feasible — [Himalayan Times](https://thehimalayantimes.com/nepal/new-directive-for-uniformity-in-govt-office-websites); [Aawaaj News](https://aawaajnews.com/nepal-news/mocit-issues-new-directive-for-uniformity-in-govt-office-websites/); a newer MoCIT directive reportedly replaced it (undated) — [Onlinekhabar English](https://english.onlinekhabar.com/new-directive-nepal-government-websites.html)
- Reported standards content: alt text on images, captions on videos, keyboard operability, clear colour contrast; content "in Nepali (Unicode) and, as far as possible, English"; DoIT added an "accessibility tool" widget across government sites — [Republica](https://myrepublica.nagariknetwork.com/news/all-govt-websites-now-made-accessibility-friendly-90-67.html)
- Act Relating to the Rights of Persons with Disabilities 2074 (2017) enumerates a right to information (Article 17) — [ADB Law and Policy Reform](https://lpr.adb.org/resource/act-relating-rights-persons-disabilities-2074-2017-nepal); [Disabled World on Press Council Nepal website](https://www.disabled-world.com/disability/accessibility/websitedesign/press-council-nepal.php)
- Prayatna Nepal Digital Accessibility Checklist (June 2026) says websites, documents and online services "remain largely inaccessible"; links the 2017 Act, National Policy and Plan of Action on Disability 2006 and National Disability Policy 2023 to accessible ICT; position paper recommends WCAG-based enforcement and developer training — [Prayatna checklist PDF](https://www.prayatnanepal.org/wp-content/uploads/2026/06/Digital-Accessibility-Checklist_Comprehensive-final.pdf); [Prayatna position paper 2022](https://prayatnanepal.org/wp-content/uploads/2022/12/Position-Paper_FINAL.pdf)
- Literacy (2021 census, 5+): 76.3% overall, male 83.6%, female 69.4%; 20,341,623 literate of 26,675,975 — [Aawaaj News](https://aawaajnews.com/?p=16333); dataset — [NSO Nepal open data](https://data.nsonepal.gov.np/lv/dataset/national-population-and-housing-census-2021-individual/resource/3db9f8ed-f6a2-4ead-887d-5a5d4d744751)

### Inferences
- Target WCAG 2.2 AA explicitly (the benchmark Nepali auditors now use), with `lang="ne"` on Nepali content so Dina/TalkBack select the right voice.
- Nearly a quarter of adults (and ~31% of women) cannot read; audio versions, icon+label buttons, and large tap targets (44 px) serve both this group and older readers on cheap screens.

### Gaps
- No official text of the 2021 directive, the "Nepal Government Web Standards", or any 2013 accessibility directive was retrievable online; the "Accessible Communication Directive 2013" named in the brief could not be confirmed to exist.
- No data on actual TalkBack/Dina adoption numbers in Nepal.

## 7. Products praised or criticised, and the design community

### Takeaway
Evidence of "good UX" in Nepal is mostly popularity and anecdote rather than formal review: eSewa's 2020 redesign praised as clean; Khalti's home screen surfaces most-used services; Hamro Patro is the default calendar (10 M+ installs by 2018) but needs plug-ins for some features; MeroShare's blank homepage and portfolio navigation drew a public redesign critique and the service has a history of login outages under IPO load; Nagarik App had 600k downloads in four months but only ~35% verified. The design community is small: IxDF Kathmandu meetups and Friends of Figma Kathmandu (288 members, "Design Jatra 2025", Config 2026 watch party).

### Cited Findings
- eSewa redesigned interface "easy to navigate and visually clean" (2020); Khalti home screen puts most-used services up front, promotions via swipe-down — [GadgetByte, digital wallets 2020](https://gadgetbytenepal.com/digital-wallets-nepal/); eSewa described as secure with a dedicated account-safety tab (2017) — [Kathmandu Post](https://kathmandupost.com/art-entertainment/2017/06/27/at-your-fingertips)
- Khalti iOS rating 3.3/5 (189 ratings) — [Apple App Store](https://apps.apple.com/app/id1263400741)
- Hamro Patro 10 M+ installs (2018); some features require a separate plug-in or app — [NepaliTelecom top apps 2018](https://www.nepalitelecom.com/2018/11/top-10-popular-nepali-apps-2018.html); popular Nepali apps Jan 2023 — [Onlinekhabar English](https://english.onlinekhabar.com/popular-nepali-apps-nepal-jan-2023.html)
- MeroShare: "blank homepage that offered no useful investment insights", hard-to-navigate portfolio, poor information hierarchy (user's redesign post) — [LinkedIn, digital afzal](https://np.linkedin.com/in/digital-afzal); 2019 login/access failures during IPO season forced investors to brokers' offices — [ShareSansar](https://www.sharesansar.com/newsdetail/meroshare-app-facing-issues-since-yesterday-what-do-the-officials-have-to-say-about-it); app launched Android Sept 2020, iOS Aug 2022 — [NepaliTelecom](https://nepalitelecom.com/meroshare-app)
- Nagarik App: 600,000+ downloads in first four months, ~35% verified (2021) — [Radio Nepal Online](https://radionepalonline.com/2021/05/16/168089.html)
- Foodmandu rebrand moved away from "traditional red and green colours" — [Technology Khabar](https://www.technologykhabar.com/?p=101548)
- IxDF Kathmandu runs free coffee/online meetups (listings through Aug 2025, WhatsApp community) — [IxDF Kathmandu online meetup Apr 2025](https://ixdf.org/meetups/ixdf-kathmandu-online-meetup-apr-12th-2025); earlier UXmandu 2018 — [IxDF UXmandu](https://ixdf.org/meetups/uxmandu-aug-18th-2018)
- Friends of Figma Kathmandu: Nepal's first official Figma user group, 288 members, Design Jatra 2025, Canvas Kathmandu (2 Aug 2025), Config 2026 watch party (24 Jun 2026) — [friends.figma.com/kathmandu](https://friends.figma.com/kathmandu); [Canvas Kathmandu](https://friends.figma.com/events/details/figma-kathmandu-presents-canvas-kathmandu)
- Ad-blocker extensions targeting Onlinekhabar, eKantipur, Setopati, HamroPatro GIF ads — see section 4.

### Inferences
- Nepali users' loudest UX complaints are reliability under load (MeroShare), intrusive GIF ads on portals, and empty/unhelpful home screens; praise goes to "clean", "most-used first" layouts (eSewa, Khalti). A news site that avoids animated inline ads already differentiates.

### Gaps
- No formal usability studies, NPS data or Play-Store review analyses of eSewa/Khalti/Hamro Patro/Daraz/Foodmandu/Pathao were found.
- No Behance/Dribbble redesign concepts of Onlinekhabar/Setopati surfaced; "Design Nepal" and "UX Nepal" as named communities were not found (IxDF Kathmandu and Friends of Figma Kathmandu are the active groups).

## 8. Dark mode, offline/PWA, push, data-saver, and trust signals

### Takeaway
No Nepal-specific adoption data exists for dark mode, PWAs, web push or data-saver browsers; Statcounter shows Opera at under 1%, and the incumbents promote native apps (eKantipur links Play/App Store) rather than PWAs. Trust cues that are documented: flag-derived crimson/blue palettes (NEPALPAY/NPS brand guidelines, Google's Nepal doodle), Department of Information registration numbers in portal footers, bank/telco advertisers, and named reporter bylines with photo credits.

### Cited Findings
- NPS/NEPALPAY brand colours "derived from Nepal's flag color, namely red and blue, to emphasize the national brand for digital payment"; red = drive/confidence, blue = calm — [NCHL brand guideline PDF](https://nchl.com.np/wp-content/uploads/2023/02/6.pdf)
- Google's Republic Day doodle used "crimson and blue colours inspired from Nepal's flag" — [Himalayan Times](https://thehimalayantimes.com/nepal/google-celebrates-nepals-republic-day-with-a-doodle)
- Setopati footer carries "सूचना विभाग दर्ता नंः १४१७/०७६-२०७७" (Department of Information registration number) — [setopati.com](https://www.setopati.com/) **[measured]**; registration is mandatory and renewed annually under the 2017 online media regulation — [AHN Legal](https://www.ahnlegal.com/legal-updates/legal/online-media-regulation-in-nepal)
- eKantipur offers Google Play and App Store apps and a copy-link toast rather than a PWA install prompt — [ekantipur.com](https://ekantipur.com/) **[measured]**
- Opera ≈ 0.78–0.8% of Nepal browser share (June–Aug 2026); Opera Mini not separately reported — [Statcounter](https://gs.statcounter.com/browser-market-share/desktop-mobile/nepal)
- A BS date-picker npm package advertises dark mode and keyboard navigation (developer-side signal that dark mode is expected in Nepali component libraries) — [@rato-guras-technology/nepali-date-picker](https://cdn.jsdelivr.net/npm/@rato-guras-technology/nepali-date-picker@1.1.0/README.md)
- **[not Nepal-specific]** Google-cited figure that >58% of users who installed a PWA also allowed push — [Speckyboy](https://speckyboy.com/progressive-web-applications.md)

### Inferences
- Use `prefers-color-scheme` dark mode as a low-cost default (Android 10+ system dark mode covers almost the whole Nepali Android base per Statcounter), but there is no evidence Nepali readers demand it.
- Visible trust package for a Nepali information site: DoI registration number (if applicable), named editor/contact phone, flag-adjacent crimson/blue accents, and clear "verified" language in Nepali (e.g. "प्रमाणित").

### Gaps
- No sources on blue-tick/verified-badge conventions in Nepali products, government-emblem use rules for private sites, or Nepal-specific push-notification opt-in rates.
- No Nepal data on Chrome Lite mode or Opera Mini usage, offline reading habits, or PWA installs.
