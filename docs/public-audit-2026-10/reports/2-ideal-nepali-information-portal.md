# Report 2: What an ideal Nepali online public-information portal must look like

Audit of Verified Nepal, October 2026. Report 2 of 3. Written 2026-10-14 for the owner; to be reviewed by a second AI agent.

Sources: the six research notes in `research_notes/Nepali online news audience/` (cited by number below; every number maps to a URL in section 7), the LLM council transcripts (`council-question.md`, `council-advisors.md`, `council-reviews.md`, `council-verdict.md`) and the owner's decisions in `docs/NEWS-PORTAL-DECISIONS.md` (updated 2026-10-14), which are treated as authoritative where they settle a point. Report 1 (audience research) did not exist when this was written, so the reference numbering here is self-contained. Where the evidence is one source, one anecdote or an inference, the text says so.

Scope: this report describes the ideal. It does not grade Verified Nepal's current site (Report 3; inventory in [97]) except where the council's reframe depends on it.

---

## 1. Executive summary

The ideal Nepali public-information portal is not a 101st news portal. Nepal has 5,135 registered online outlets [64], roughly 8% of surveyed Nepalis trust online portals and 2-3% trust social media [4][2], and 67% say they saw misinformation in the past week [7]. Readers discover on Facebook (primary news source for 62% overall and 82.6% of 16-24s [2]) and then verify on radio and TV bulletins [3][5]. The verification seat is therefore open and nobody online holds it. The council's reframe, which this report adopts, is that the ideal is a **checked record**: a Nepali-first status board of short, dated, located, sourced items, each with a permanent URL that a Facebook post, a Viber forward or an FM host can cite, backed by a ward-level needs-to-delivery ledger for disasters, and distributed as share cards into the feeds where Nepalis already are [96]. It competes for the verification role currently held by radio/TV and by two tiny fact-checking organisations [25][60], not with Facebook for discovery and not with Onlinekhabar for page views. Its success metric is how often it is cited, not how often it is visited. The two Nepali brands readers actually praise, Routine of Nepal Banda and Hamro Patro, both won a narrow daily-checked utility first and broadened later [22][57]; neither is a newsroom. The ideal copies that shape, adds provenance on every item (because logos and official formats are forged [27]), stays inside the legal posture a small operator can sustain (pre-moderated, non-commercial, no comments) until a registered entity exists [64][95], and never shows an empty page or a stale "live" number.

---

## 2. Design principles

Each principle is traced to the pain point it answers and the evidence for that pain point. Confidence is stated where the evidence is thin.

| # | Principle | Pain point it answers, with evidence | Confidence |
|---|---|---|---|
| P1 | **Provenance over logos.** Every item carries a link to the original source, the source's own timestamp and, for official figures, the bulletin number ("NDRRMA bulletin, 17 Sept, 1,410 dead / 6,145 missing, provisional"). | Scammers copy "the logos, names, or formats of official government agencies" within 48 hours of a disaster [27]; official counts changed bulletin to bulletin in Aug-Sept 2026 [26][35]; fact-checkers won trust by locating the original upload and date, not by branding [26]. | High (consistent across 2015-2026 events) |
| P2 | **Nepali-first, with an EN chip.** Default to Devanagari Nepali on first visit; each item shows in the language it was written in with a two-letter EN / ने chip; the toggle changes chrome only. No machine-translated copies. | Nepali portals treat English as a separate property, not a per-article toggle [45][46][47]; the owner has already decided per-item language with a chip [95]. 55% of Nepalis have a non-Nepali mother tongue [6], so Nepali-first is necessary but not sufficient (see P11). | High on default; the chip pattern is an inference from incumbents' "EN" affordance |
| P3 | **Every item is dated, located and sourced, or it does not publish.** Place to ward/palika, `happenedAt`, source link. The Desk rule is already "Reject if no source, no place, or no date" [95]. | "Incomplete information presented without context is, in a way, a form of misinformation" (Ujjwal Acharya on RONB-style snippets) [23]; copy-paste wire content "one-two days old" [15]; local news is the gap the national survey's authors name [2]. | High |
| P4 | **No clutter, no ads that readers block.** No animated/GIF creatives, no interstitials, no ads in notifications, nothing above the fold on disaster items. | Ad load is the single most recurring Reddit complaint; four threads exist solely to build blockers because Nepali portals serve static banners that uBlock cannot catch [13][14][15][16]; Hamro Patro's reviews are dominated by unskippable video ads and ads pushed as notifications [18]. | High (pervasive), though the Reddit sample is nine threads skewed to Onlinekhabar [13] |
| P5 | **Speed on a 360 px Android on congested evening 4G.** Light first load, no map or large JSON before the reader asks for it. | 75% Android [11] and many mobile connections are voice/SMS-only [94]; top viewports 414x896 and 360x800 [10]; NPR 13-15k phones ship 4 GB RAM [12]; traffic peaks 8-11 pm when ISPs share lines among 4-8 subscribers [8][9]; "news loads slower" is a top Play complaint [17]. | High on constraints; no Nepal study defines "fast" [research gap] |
| P6 | **One meaning of "verified".** Two labels only: "आधिकारिक स्रोत / Official source" for items relayed from OPMCM, NDRRMA, DHM, Nepal Police; "जाँच गरिएको / Checked" for anything a volunteer moderator approved. Nothing else is called verified. | The council found five senses of "Verified" on the current site [96]; readers' trust problem is that "verified" claims are made by everyone, including a Facebook page named like a radio station that posted recycled footage [26]. | High |
| P7 | **Honesty about staleness.** Relative time on every item ("११ घण्टा अगाडि"), an absolute BS + AD date on the item page, "last verified" on every centre or ledger row, and a snapshot label whenever data is not live. | A "Live" label over a snapshot from 2026-08-29 is the single most damaging credibility leak the council found [96]; NDRRMA itself marks figures "provisional and subject to change with each bulletin" [35]. | High |
| P8 | **Safe by default for the dead, the missing and children.** No faces of the dead, no gruesome thumbnails or autoplay previews, AI images labelled "एआईद्वारा सिर्जित सांकेतिक दृश्य", family consent before a missing-person listing, parental consent for under-18s, listings pulled on resolution. | Press Council Nepal's Editorial Guidelines for Humane and Responsible Disaster Reporting, 2083 (4 Sept 2026) [72]; the Minister's direction on children's dignity under the Child-Friendly Communication Directive 2073 [73]; UN Nepal's statement on verifying missing-person photos [74]; Penal Code ss.295-296 on photographs without consent [75]; 67 of 101 PCN complaints after the flood were about gruesome personal-account posts [26]. | High on the rules; no Nepali source discusses consent for missing lists specifically [research gap] |
| P9 | **A public corrections log.** Every edit after publish is visible, dated and explained; retractions keep the URL and say why. | The 2025 Press and Publication Rules require errors corrected "promptly and publicly" [64]; PCN 2083 requires immediate correction with explanation [72]; PCN's own remedy ladder starts with rectify-and-republish and ends with removal and blacklisting [77]; Sidhakura's editors were jailed for repeated republication of unverified audio [71]. | High |
| P10 | **Accessible to TalkBack users and to people who do not read well.** `lang="ne"` markup so the Dina Nepali TTS voice is selected, WCAG 2.2 AA, 44 px targets, icon + label buttons, short sentences. | Dina (दिना) launched Dec 2024 as the first realistic Nepali screen-reader voice [52]; the 2026 DoIT audit used WCAG 2.2 AA and found skip links, contrast and PDF-only content failing [53]; MoCIT's 2021 directive requires responsive, disability-friendly sites in Nepali Unicode and English [54]; literacy is 76% overall and 69% for women [6]; only 13.1% of illiterate respondents consume news digitally [2]. | High on rules; no Dina adoption numbers exist [research gap] |
| P11 | **Room for Madhesh and non-Nepali mother tongues.** Item language is a field, not a site setting; Maithili and Bhojpuri items are possible later without redesign; place names accept Hindi/Maithili spellings. | Madhesh is 21% of the population and reads online news at 19.9% vs 69.5% in Gandaki [2][6]; Maithili 11.1%, Bhojpuri 6.2% mother tongue [6]. | Medium: the need is well evidenced, the design response is untested |

---

## 3. The ideal, by layer

Each layer lists concrete requirements (numbered for the scorecard in section 4) and a short "what good looks like".

### 3a. Home / "Now" surface

Requirements:

- **H1** Masthead shows today's BS date in Devanagari digits in the incumbents' form ("बुधबार, असोज २८, २०८३"), with the AD date in metadata and in a smaller line [45][46]. Month naming is a style choice; the colloquial असोज (Setopati) reads more spoken than आश्विन (eKantipur) [46].
- **H2** A "Now" strip of 3-5 items is the first block. Each row: place, what, relative time ("२ घण्टा अगाडि"), label (P6), source link, EN/ने chip. The strip is fed from whatever the site already ingests (official notices, centre verifications, ledger deliveries, published local updates), so it is never empty even when no volunteer writes [96].
- **H3** The first interactive element after the strip is a locality question, not a category bar: "तपाईंको पालिका?" with a picker that accepts Nepali, English, Roman-Nepali and old VDC names [95]. The reader's intent is a question ("does my palika have X?"), not a feed [96].
- **H4** A hotline bar on every page (the state's own alert SMS lists hotlines [30]); numbers tappable.
- **H5** No empty states, ever. A chosen locality with nothing collapses to the next tier (Municipality, District, Nepal) so no heading renders over nothing [95]. Surfaces whose API returns zero are not linked from navigation.
- **H6** Navigation is six items or fewer, in words a shopkeeper uses: अहिले (Now), सहयोग चाहियो (Get help), सहयोग दिन्छु (Give help), मानिस खोज्नुहोस् (Find someone), राहत केन्द्र (Drop centres), खाता (Ledger) [96]. Acronyms (OPMCM, NDRRMA, NPT) are expanded on first use.

What good looks like: a Hetauda shopkeeper opens the site at 8 pm on a 360 px phone, sees today's BS date, three dated items with places and sources, a box asking for her palika, and the hotline bar, all in Nepali, in under two seconds on 4G. Nothing says "Live" unless it is.

### 3b. Item model

Requirements:

- **I1** An item is short: 6-7 lines, the RONB length that readers call "easy-to-digest snippets" [22][24]. Long-form survives only as evergreen explainers (3j).
- **I2** Required fields: `lang`, `scope` (Ward/Municipality/District/Province/Nepal), `locality`, `happenedAt`, `sourceUrls[]`, `expiresAt` where relevant, label. These are the fields the owner has already decided [95].
- **I3** Headline and body agree. The first line is the fact, not a tease; "यस्तो छ…/हेर्नुहोस्" constructions are rejected at moderation. Headline-body mismatch is the measured Nepali form of clickbait [19][20].
- **I4** Status label vocabulary is exactly two values (P6): "आधिकारिक स्रोत / Official source" and "जाँच गरिएको / Checked". The label states who checked (role, not personal name, see 3h) and when.
- **I5** Permanent URL that survives edits and retractions, with `datePublished`/`dateModified` in machine-readable form and an `article:published_time` tag, so the item is a citation target for fact-checkers and journalists.
- **I6** Byline shows the contributor's public profile (locality, published count) and "तस्बिर :" photo credits, the incumbents' trust cue [45][46].
- **I7** Each item renders as a PNG share card with the label, place, date and URL baked in, for Facebook, WhatsApp and Viber (3g).

What good looks like: "रसुवा, उत्तरगया-३ · ४० त्रिपाल पुगे · २ घण्टा अगाडि · जाँच गरिएको · स्रोत: वडा कार्यालय" with a tap to the source and a tap to share.

### 3c. Verification and moderation display

Requirements:

- **V1** Pre-moderation for everything public (owner decision [95]). Readers never see an unreviewed item. This is also the lower-risk legal posture: the 2017 directive and its 2025 successor make the operator "fully responsible" for content and comments [65][64].
- **V2** The mark asserts only what it asserts. A short "what this label means" line is one tap from every label: "Checked" means a volunteer moderator confirmed the item has a named source, a place and a date and that the source says what the item says. It does not mean the site witnessed the event, and it does not mean a government body endorsed it.
- **V3** Reviewer rules are published: a reporter never reviews their own post; Ward/Municipality scope may be approved by a same-district moderator (audit entry records `localReview: true`); District scope needs a moderator outside the reporter's home district; Province/Nepal scope needs a national moderator; 5 submissions per 24 h per reporter; three rejections in 90 days flag the account [95].
- **V4** The Desk rule card carries the PCN 2083 five-point check for social-media material (source, location, time, context, independent evidence), a reverse-image-search step, and the no-faces-of-the-dead and AI-labelling rules [72]. The recurring Nepali failure is republishing viral material, not fabrication [60][26].
- **V5** Corrections and retractions are a visible log (P9). A corrected item shows "सच्याइयो" with date and a one-line reason; a retracted item keeps its URL and shows what was wrong.
- **V6** Public flag mechanism on every published item (one tap, reason list, no account needed), routed to the existing flagged queue [95]. Flags are not comments and are not displayed.
- **V7** Moderator capacity is a published number, not a promise: "N moderators active this week in M districts", so readers can judge coverage honestly. (Inference: no Nepali site does this; it follows from P7.)

What good looks like: a reader taps "जाँच गरिएको", reads two sentences on what was checked and by what role, sees the source link, and can flag it in one tap if the source does not say that.

### 3d. Language, script and input

Requirements:

- **L1** Devanagari typography: body 17-18 px, line-height 1.7-1.8, no letter-spacing inside words (it breaks the shirorekha), emphasis by weight or colour rather than synthesised italics, conjuncts (क्ष, ज्ञ) tested on a cheap Android and on iOS [43][51]. These sizes come from a single Nepali agency article and should be treated as a starting point, not a standard [43].
- **L2** Two self-hosted Devanagari weights (400 and one heavier), `font-display: swap`, preload the body weight. One Devanagari weight costs 38-62 KB woff2, so two weights plus Latin is roughly 100-150 KB; Ratopati's six Mukta weights cost ~370 KB [44]. Mukta reads "native" to Setopati/Ratopati readers; Noto Sans Devanagari has safer conjunct coverage [43][44].
- **L3** Devanagari digits in Nepali chrome and dates; ICU `ne-NP` already produces them with lakh/crore grouping (१,२३,४५,६७८) [research note measurement]. Latin digits in URLs and machine metadata.
- **L4** Roman-Nepali input everywhere a reader types: the locality picker and search transliterate "ram bahadur" or "hetauda" server-side to Devanagari before matching [48][50]. Search normalises NFC, folds ि/ी and ु/ू, folds nukta, and accepts loanword spelling variants, because Nepali has no enforced spelling norm [49].
- **L5** Separate-language items, not machine translation. An item exists in the language it was written in; a second-language version is a second item written by a person. Moderators declare the languages they review and the queue filters by it [95].
- **L6** Room for Maithili and Bhojpuri: `lang` is per item, place names carry alternates, and fonts cover the Devanagari range those languages use (P11).
- **L7** Legacy Preeti/Kantipur-encoded text is converted to Unicode before publishing; search engines and screen readers see gibberish otherwise [43].

What good looks like: a Gulf worker types "nuwakot" on an English keyboard and lands on नुवाकोट; the page reads in Mukta at 17 px with nothing letter-spaced; TalkBack reads it in a Nepali voice.

### 3e. Dates, numbers, time

Requirements:

- **D1** BS and AD both shown on item pages; BS primary in Nepali chrome, AD in metadata and URLs, matching incumbent practice [45][46][47]. There is no ICU Bikram Sambat calendar, so BS needs a conversion table [research note measurement].
- **D2** Relative times ("११ घण्टा अगाडि") on lists, the Onlinekhabar convention [47], always with the absolute timestamp one tap away.
- **D3** All times in NPT (UTC+05:45), labelled "नेपाली समय" or "NPT" on first use. For diaspora readers, the item page shows the local time of the device in a smaller line, because Gulf readers are 2h45m behind Nepal and read after shifts [85].
- **D4** Numbers in lakh/crore in Nepali text (५० लाख) and with a Western grouping in the EN view; relief sums carry the currency symbol रु.
- **D5** Casualty and relief figures always carry "as of [bulletin time], source" (P1), never a bare number [35].

What good looks like: "१,४१० मृत्यु · ६,१४५ बेपत्ता · NDRRMA बुलेटिन, १ असोज २०८३ १८:०० · प्रारम्भिक" above "1,410 dead · 6,145 missing · as of 17 Sept 2026 18:00 NPT".

Evidence gap: no reader study on BS vs AD or Devanagari vs Latin digit preference exists [research gap]; the recommendation follows incumbent practice.

### 3f. Performance and data cost budget

Requirements:

- **F1** First load of the Now surface under 300 KB transferred, including fonts, on a 360 px device; total page under 1 MB with images. Nepali portals' raw HTML alone runs 60-234 KB, and Hamro Patro's homepage HTML is 1.72 MB [measured in research note]; a 1 MB page is competitive, 300 KB is a lead.
- **F2** No map library, no satellite tiles and no large JSON on first load. Maps and person-search data load only when the reader asks. The council flagged a 1.5 MB JSON precached on first visit and a map on home as the current anti-pattern [96].
- **F3** Service worker caches the shell and the last Now strip so a reader with a dropped connection still sees the last-known items, each stamped with its fetch time (P7). Do not precache content the reader has not requested.
- **F4** Cache honesty: every cached item shows when it was fetched; nothing cached is labelled live.
- **F5** No third-party scripts, no analytics beacons that a Nepali ad blocker list would strip anyway [16]; first-party page-reach counts only.
- **F6** Images: one width per breakpoint, modern formats, lazy below the fold; thumbnails never autoplay (also a PCN 2083 rule [72]).

What good looks like: at 9 pm on a shared fibre line in a hill district, the strip renders before the font swaps in, and the map on the flood page is a button, not a default.

Evidence gap: per-GB data is cheap (roughly Rs 45/GB on small packs [12]), so the budget is about latency on congested links, not cost; no Nepal-specific "what counts as fast" study exists.

### 3g. Distribution

Requirements:

- **X1** The site is the citation target; the feed is the channel. Facebook reaches ~90% of Nepali internet users [1] and 62% use it for news [2]; incumbent portals get 69-83% "direct" traffic that includes app and dark-social pastes [55]. Design every item to be pasted, not browsed to.
- **X2** An owned Facebook page posts the share cards daily in the 6-10 pm window, the evening peak [8][9]; a Viber community is the fallback because Viber and TikTok stayed up when 26 platforms were blocked on 4-9 Sept 2025 [58][59]. `Organization.sameAs` lists these.
- **X3** Share cards (I7) carry the label, place, date and permanent URL baked into the PNG, so a forward stripped of context still shows provenance; WhatsApp and Viber share buttons alongside Facebook. No Nepal data exists on Viber/WhatsApp news sharing [research gap]; the choice follows the 2025 block.
- **X4** RSS and a JSON feed of published items, for aggregators (Hamro Patro republishes portal content [research note]), FM stations and fact-checkers. 48% of regular portal visitors in 2022 arrived via push and 57% via friends' links [4]; RSS is how third parties build those pushes without the site running a notification channel itself.
- **X5** Cadence: one daily "आजको जाँच गरिएको" bulletin at 6-10 pm NPT, plus a 6-9 am item for the radio-habit audience and Gulf workers before shifts [88][85]. During a disaster, the first checked item matters more than completeness: AI footage reached 7 million views in the gap before official voices in Aug 2026 [26].
- **X6** Diaspora: the EN chip, device-local time (D3), and the ledger (3i) as the thing NRNA chapters cite when asking "what reached Nepal" [40]. US and Australia are the largest overseas sources of portal traffic [87]; Gulf and Malaysia hold 85% of labour migrants [86].
- **X7** Short vertical video with Nepali captions is the native format for under-35s [89]; the ideal publishes the daily bulletin as a captioned 30-second card-video to the owned pages when capacity allows. This is a distribution requirement, not a reason to host video.

What good looks like: an FM host in Dhunche reads the 6 pm card on air and says the URL; a cousin in Doha forwards it on Viber; both arrive at the same permanent page with the same label and date.

### 3h. Trust and transparency surfaces

Requirements:

- **T1** "Who runs this" page: the operating entity, its governance document and its moderation guidelines linked from the footer of every page. The council found these exist but are unlinked [96].
- **T2** DoIB registration number in the footer once registered, in the incumbents' form ("सूचना विभाग दर्ता नं …") [45]; until then, a one-line honest statement of status and the words "local updates / local correspondents" rather than "news / reporters" [95].
- **T3** Public audit log of moderation actions (approve, reject, correct, retract) by role and time, without personal names.
- **T4** Ledger of needs, offers and deliveries at ward level (3i), public and masked.
- **T5** "हामी पैसा लिँदैनौं / We never handle money" on every donation-adjacent surface, with deep links only to accounts listed on NRB, OPMCM or MoF sites, never a QR code or wallet number rendered by the site. Fake PM-fund QR codes appeared within 48 hours of the flood [27][28].
- **T6** Fake-QR and scam warning as a standing item during disasters, quoting the Police and NRB advice [27][28].
- **T7** A named contact that is safe to publish: a role address and phone for the entity (not a private individual's), and an in-page flag/correction form. Named volunteers, particularly women, face doxxing and threats with no state response mechanism [79][68][93]; the 2025 protests made outlet identification a physical liability [78]. Public bylines use the contributor's chosen public profile; home address and personal phone never appear.
- **T8** Privacy policy in both languages, with the consent rules for missing-person and photo content stated plainly (P8).

What good looks like: the footer reads, in Nepali, who operates the site, its registration number, a link to how items are checked, a link to the corrections log, and "we never handle money", and every one of those links opens a real page.

### 3i. Disaster-specific surfaces

Requirements:

- **S1** Missing-person search with a consent-and-privacy posture: family-initiated entries, verification against official lists (Nepal Police, NRCS Restoring Family Links), no photos of the dead, children's identifying details off the public page, listings pulled on reunification, and the page kept out of search indexes [72][74][75][76]. Volunteers in 2026 said "there was no centralized database" [32] and a civil servant's overnight dashboard preceded the government's own missing-persons search by days [31]; the state's own practice (names and DOBs on Facebook, QR-linked body photos, LED screens of corpses [33][34]) is permissive, so dignity is the differentiator, not compliance. Cross-script name search must work (L4).
- **S2** Relief ledger: needs, offers and deliveries at ward level, with household counts and criteria, not recipient names (eligibility lists caused disputes in Saptari 2024 and Jajarkot 2023 [39]). Record deliveries as facts with source and date; never editorialise absence, because "Ward 3 was not reached" names a CDO and is defamation and ETA s.47 bait [67][82]. The adoption hook, ward chairs wanting a public record that relief had not arrived, rests on one Kathmandu Post report and is marked as inference in the research [29]; treat it as a hypothesis to test with two or three ward chairs.
- **S3** 3W export (who does what where) as CSV/GeoJSON with district, municipality, ward, household counts disaggregated by sex and age, matching the fields NGOs already publish in sitreps [35]. Each INGO currently duplicates situation reporting [research note KQ7].
- **S4** Drop centres with "last verified" date and time on every row, a phone number, and automatic demotion of centres unverified for more than N days (P7).
- **S5** Early-warning links: DHM bulletins, the PrakopAlert app, BIPAD, with the honest note that alerts have arrived after the water (38 minutes after the 2026 collapse [30]; "there is no such thing as an early warning system in Nepal" [30]; 2022 SMS alerts reached only areas already affected [90]; seconds matter on the Bhote Koshi [91]). Linking BIPAD confers legitimacy; TikTok already does [38].
- **S6** A pre-templated rumour tracker: the repertoire is stable across 2015-2026 ("bigger disaster coming", "relief hoarded", recycled footage, fake death tolls, fake fund appeals) [26][36]; each entry links the fact-checker's debunk.
- **S7** Multi-disaster model: nothing on the home page is hard-wired to one event; the current disaster is a selectable context with its own bulletin source.

What good looks like: in the first hour of the next flood, the Now strip shows the DHM alert with its SMS time, the official hotline, a "do not trust QR codes" card, and the first checked local item; by day three, the ledger shows deliveries per ward with sources, and an INGO downloads the 3W without asking.

### 3j. Quiet-months content

The research is clear that relief delivery is not a daily beat and that no Nepali survey covers what readers want from a civic site in Falgun [96]. The ideal's quiet-months answer is drawn from what earns daily habit in this market, utility and evergreen search [56][57], and from what the national survey's authors asked for, localised grassroots content [2].

- **Q1** Evergreen explainers in plain Nepali: how relief works, how to read an NDRRMA bulletin, what a ward office can and cannot do, how to prepare a household for monsoon, what "loss and damage" means (only 49% of households had heard of climate change in 2016 [42]), paired with what wards needed and did not get, the pairing domestic critics ask for [41]. Owner-written explainers carry no news exposure and are the only long-form the ideal keeps.
- **Q2** Local updates (pre-moderated, as decided [95]) as the human layer: a road reopened, a health post's hours, a school closure. This is the content shift from macro-politics that readers and the survey's authors name [2][23].
- **Q3** Ledger and centre status as standing items: "N centres verified this week", "last delivery logged", so the record is seen to be maintained.
- **Q4** Preparedness-season cadence: a weekly card in Jestha-Asar (pre-monsoon) on alerts, hotlines and evacuation routes per district.
- **Q5** What the ideal does not do in quiet months: fill the strip with national politics or wire copy. If there is nothing checked today, the strip says so with yesterday's items and their dates (P7).

Evidence gap: whether a civic record earns a daily check outside disasters is untested in Nepal; RONB's beat (bandas, power cuts) was daily by nature [22]. This is the largest open question in section 6.

### 3k. Governance, legal posture and monetisation

Requirements:

- **G1** Registration path, as decided: the entity registers with DoIB as the online media outlet; contributors publish under it [95]. The 2025 Press and Publication Rules require a company or firm with PAN/VAT, a named editor with journalism qualification or experience, at least three employees with a written commitment to bank-paid salaries, Rs 5,000 registration and Rs 2,500 annual renewal, and display of registration number, addresses, editor and journalist names and a privacy policy [64][66]. These figures come from eKantipur's reading of the rules and law-firm summaries, not the official text; the decisions doc already says confirm with DoIB directly [95]. Registration is a legal entity and a payroll, not a form [96].
- **G2** Until registered, the public posture is pre-moderated, non-commercial "local updates / local correspondents", with no ads on news-like items [95][96].
- **G3** Press Council jurisdiction follows registration and is, on balance, protective: Freedom Forum argues complaints should go to PCN rather than police under s.47 [78]; PCN's 2026 remedies were mostly rebuttals and corrections [77]. The ideal publishes PCN's code and the 2083 disaster guidelines as its own moderation checklist (V4).
- **G4** ETA Section 47 awareness: electronic publication "contrary to public morality" or spreading hatred by caste/community carries up to 5 years and a fine [67]; it has been used against journalists after complaints from local officials in 2024-2026 [69][68]; the 2025 Social Media Bill was withdrawn in Feb 2026 but the 2023 directive that enabled the platform block still stands [70]. Design consequence: no user comments, no anonymous public posting, moderation of anything naming an official, and a documented incident procedure.
- **G5** No comments. The 2017 directive makes the operator responsible for comments and obliges it to prevent "vulgar, dishonest or irrelevant" ones [65]; no Nepali-language automated moderation tool exists [research gap]; the Cyber Bureau profiled abusive commenters after the 2026 flood [82]. Public flags (V6) replace comments.
- **G6** Ads only after registration; two labelled slots ("विज्ञापन / Sponsored"), admin-placed image-link items with dates and area [95]; never on disaster items, never animated, never in notifications (P4). Government public-welfare ads additionally require Advertisement Board listing [80]. Readers' sharpest content complaint about RONB is paid posts indistinguishable from news [23].
- **G7** Donations off-site only (T5). The sole ad-free membership experiment in Nepal, The Record, went on extended hiatus in 2022 for financial reasons [63]; Kantipur launched its first digital subscription in Aug 2026, aimed at diaspora [62]. The ideal does not assume reader payment; if diaspora or NGO revenue is ever pursued, it is for the ledger/3W data layer, not for reading.
- **G8** Operational security: CMS and admin accounts are the attack surface (the Ukeraa breach replaced investigative stories with unrelated content [83]); backups allow republication; two-factor on every editor account.
- **G9** Contributor safety: no personal contact details published, pseudonymous public profiles permitted where lawful, no outlet branding on field volunteers during unrest [78].

### 3l. Accessibility and inclusion

- **A1** WCAG 2.2 AA, the benchmark Nepali auditors now use [53]: skip links, keyboard-operable menus, 4.5:1 contrast, visible focus, 44 px touch targets, labelled forms, HTML-first (no PDF-only notices).
- **A2** `lang="ne"` on Nepali content and `lang="en"` on English so TalkBack selects Dina [52]; government accessibility pages already direct users to install it [research note].
- **A3** Captions on any video; alt text on every image; the hotline bar as real text, not an image.
- **A4** Plain language and audio: 24% of adults and 31% of women cannot read [6]; the daily bulletin is also published as a captioned audio/video card (X7) and every item is TTS-clean (no ASCII art, no Preeti).
- **A5** Madhesh and non-Nepali mother tongues: item-level language (L5/L6), place-name alternates, and a stated intention to add Maithili/Bhojpuri contributors when moderators exist for those languages.
- **A6** Low-end device testing as a release gate: one NPR 13-15k Android (4 GB RAM) and one iPhone, on 4G, for every typography or layout change [12][43].

---

## 4. Persona scorecard

Personas follow the research notes. The rightmost column lists the requirement IDs from section 3 that answer each pain point.

| Persona | Top pain points (evidence) | Ideal-layer requirements that answer them |
|---|---|---|
| **Consumer (in Nepal, mobile, Facebook-first)** | Ads covering half the page, unblockable [13][14]; clickbait headline-body mismatch [19]; nothing local [2]; slow load on cheap Android [17][12]; "which portal to believe" fatigue [21] | P4, F1-F6 (no clutter, fast); I3 (headline = fact); H3, Q2 (locality first, local updates); P1, I4, V2 (provenance and one label) |
| **Diaspora reader (Gulf/Malaysia worker; US/UK/Australia family)** | Deceived by YouTube "news" with no way to cross-check locally [25]; wants bite-sized, cross-checkable snippets [24]; reads after shifts in a different time zone [85]; types in Roman Nepali | I1, I5 (short, permanent, citable); D3 (device-local time); L4 (Roman input); X3, X6 (share cards, EN chip); S1 (missing-person search that works cross-script) |
| **Disaster-affected person or family** | No centralised missing database [32]; graphic images of the dead shared without warning [26]; relief claimed sent but not arrived [29]; alerts after the water [30]; fake fund appeals and OTP scams [27] | S1 (consent-first missing search), P8 (safe by default), S2 (ward ledger as facts), S5 (early-warning links, honest), T5-T6 (no money, scam warnings), H4 (hotlines everywhere) |
| **Volunteer / donor (incl. NRNA chapters)** | Cannot tell which appeal is real [27][28]; cannot see what reached Nepal [40]; 2015 PM-fund opacity remembered [research note KQ3] | T5 (deep-link only to NRB/OPMCM-listed accounts), S2-S3 (ledger and 3W), T3 (audit log), X6 (diaspora distribution) |
| **NGO / local government (ward chair, palika staff, INGO cluster)** | Each agency duplicates sitreps [35]; needs ward/household/sex/age fields and export [35]; BIPAD is institution-facing with terminology and metadata gaps [37]; palika staff have phone-and-Facebook skills only [research note KQ8]; only 54 of 753 local levels answered RTI requests [84]; ward chairs contest CDO claims [29] | S3 (3W export in their fields), S2 (ward-level record of deliveries), H3 (palika picker), L4 (Roman input), A1 (works on any phone); the ward-chair hook stays a hypothesis |
| **Publisher / maintainer (one owner plus volunteers)** | Zero supply at peak demand [96]; registration needs entity and payroll [64]; sector-wide arrears and closures (2023: 100 outlets closed, 243 journalists quit, all media) [61][81]; dependence on Facebook referrals that vanished for five days in 2025 [58] | H2 (strip fed from ingested data, not prose), G1-G2 (posture until registered), G6-G7 (no revenue assumptions), X2, X4 (owned page, Viber fallback, RSS), G8 (CMS security) |
| **Journalist / correspondent (district stringer, FM host, national desk)** | Needs a citable permalink with date and source to confirm a claim [26]; copy-paste culture [research note KQ4]; local officials hostile to accountability reporting, online journalists over half of victims [78]; unpaid for months [81] | I5 (permanent URL, machine-readable dates), V5 (corrections log), X4 (RSS), T7, G9 (safety; no personal details), I6 (byline credit) |
| **Moderator / fact-checker (volunteer; NepalFactCheck, Nepal Check)** | Overwhelmed in crises, dozens of checks a year against thousands of claims [60]; recurring repertoire of recycled footage and AI video [26]; friend-approves-friend risk; liability for what passes [71] | V1, V3 (pre-moderation, reviewer rules), V4 (PCN 2083 five-point check on the rule card), S6 (rumour tracker linking debunks), V7 (published capacity), X4 (feed for fact-checkers) |
| **Regulator (DoIB, Press Council, Cyber Bureau)** | Unregistered outlets ordered to remove content [77]; gruesome visuals and children's identities after the flood [26][73]; uncorrected errors [64]; comments and user content as the practical reach of enforcement [82] | G1-G3 (registration path, PCN code as own checklist), P8, V4 (humane-reporting rules built in), P9, V5 (public corrections), G5 (no comments), T2 (registration number displayed) |

---

## 5. What the ideal deliberately does not do

| Not done | Why |
|---|---|
| **Comments** | Operator is liable for them under the 2017 directive and must prevent vulgar or dishonest ones [65]; no Nepali-language moderation tooling exists; the Cyber Bureau profiled commenters in 2026 [82]; readers already read comment moderation as censorship [17]. Flags replace comments. |
| **Push notifications and notification ads** | Hamro Patro's most-upvoted complaints are ads as push and "constant barrage of irrelevant notifications" [18]. Distribution runs through RSS, the owned page and cards; third parties may build pushes from the feed. |
| **Dark mode first** | Requested in Play reviews [17] but no Nepal evidence it drives trust or return; the council deprioritised it [96]. Honour `prefers-color-scheme` if it costs nothing; do not design for it before the strip, the ledger and the picker exist. |
| **Autoplay video and gruesome thumbnails** | Prohibited by PCN 2083 on websites and all platforms [72]; heavy on congested links (F1). |
| **Clickbait and teaser headlines** | The measured Nepali complaint [19]; rejected at moderation (I3). |
| **Machine-translated copies** | Each item exists in the language it was written in [95]; a machine copy would carry the "Checked" label on words no one checked. |
| **753 empty locality pages** | Only localities with a published item are listed anywhere [95]; an empty heading falsifies "verified" on first visit [96]. |
| **A national politics feed or wire copy** | The complaint readers and survey authors make about incumbents [2][23]; it would also make the site a news portal in substance before registration. |
| **Collecting donations, showing QR codes or wallet numbers** | QR codes copying official logos were the main scam vector [27]; deep links to NRB/OPMCM-listed accounts only. |
| **Publishing recipient name lists** | Eligibility disputes in Saptari and Jajarkot [39]; publish criteria and counts. |
| **Editorialising about officials or absence of relief** | ETA s.47 and criminal defamation have been used after local officials' complaints [69][67]; the ledger records deliveries as facts with sources. |
| **A heavy map, satellite tiles or large JSON on first load** | F2; the current site's anti-pattern per the council [96]. |
| **Six font weights, Google-hosted** | ~370 KB of Devanagari before Latin [44]; two self-hosted weights. |
| **Ads before registration, or on disaster items** | G6 [95][96]. |
| **An AI writer, condolences, an ad-manager role, SSR, Nepali URLs with hreflang** | Deferred by the owner or the council until there is content to index and a second person to run ads [95][96]. |
| **Owner-authored news** | One anonymous person writing news is online journalism with no community check; owner-written evergreen explainers are fine [96]. |

---

## 6. Open questions and evidence gaps

Where the evidence behind this report is thin, the ideal is a hypothesis. In rough order of strategic weight:

1. **The ledger adoption hook rests on one anecdote.** Ward chairs in Amachhodingmo contesting the CDO's "relief already sent" is one Kathmandu Post report [29], and the research note marks "ward chairs would log deliveries" as inference. No interview or survey of ward or municipal officials on using a third-party platform exists. Test with two or three ward chairs before building field workflows.
2. **No post-September-2025 audience survey.** The latest Nepal Media Survey figures reachable are 2024 [2]; nothing quantifies where Nepalis got news after the platform block, the protests and the 2026 flood. The "verify on radio/TV" finding is from 2022 commentary [3].
3. **Reddit evidence is nine threads**, all about Onlinekhabar or ad blocking, retrieved from an archive because Reddit blocks the research environment [13]. Praise for RONB and Hamro Patro comes from press coverage and Play reviews, not from a representative sample [22][24][18].
4. **No reader data on BS vs AD or Devanagari vs Latin digits.** The recommendation follows what Setopati, eKantipur and Onlinekhabar do [45][46][47]. A plugin vendor's claim that Press Council rules require BS dates is unverified.
5. **Typography numbers come from one agency article** (17-18 px, 1.7-1.8 line height) [43]; no Nepal-specific study of FOUT or line-height preference exists.
6. **Quiet-months demand is untested.** RONB's daily beat was daily by nature; whether a civic record earns a 6-11 pm check in Falgun is unknown (3j).
7. **Trust cues are inferred, not measured.** No experiment shows which visual cue (phone number, ward-chair quote, Nepali language, verifier role) increases belief among Nepali readers; "provenance beats logos" is inferred from fact-checker practice and from scammers' behaviour [26][27].
8. **Registration rules are second-hand.** Fees, editor qualification and the three-employee rule come from eKantipur and law-firm summaries [64][65][66]; the official DoIB schedule was not retrieved; the exact ETA s.47 fine conflicts across sources [67]. Confirm directly, as the decisions doc already says [95].
9. **No Nepali source on consent for missing-person listings or survivors' phone numbers.** P8 and S1 derive from PCN 2083, the UN statement and the Penal Code [72][74][75], not from documented Nepali practice.
10. **Distribution channels lack Nepali data.** No figures on Viber/WhatsApp news sharing, Google Discover share, push opt-in, RSS use or Nepali-language SEO [research note KQ2 gaps]. The Viber fallback follows the 2025 block [58][59], not measured usage.
11. **Diaspora media habits are thin.** A 281-respondent COVID-era Malaysia survey and traffic estimates [85][87]; nothing on Gulf workers' news habits specifically.
12. **Dina TTS adoption and Nepali hate-speech tooling** are undocumented [52]; accessibility requirements rest on law and audits, not on user counts.
13. **No usability study of any Nepali news portal exists** beyond two practitioner case studies [92]; a small structured test of the ideal's Now strip and picker with ten readers (including Madhesh and Gulf participants) would be new evidence.

---

## 7. References

Research-note URLs are reused verbatim. Local documents are listed at the end.

1. DataReportal, Digital 2026: Nepal (8 Nov 2025). https://datareportal.com/reports/digital-2026-nepal
2. Nepali Times, "What do Nepalis think of the media" (Nepal Media Survey 2024), 27 Dec 2024. https://nepalitimes.com/what-do-nepalis-think-of-the-media
3. Nepali Times, "Surveying Nepal's digital landscape" (NMS 2022), 15 Oct 2023. https://nepalitimes.com/surveying-nepal-s-digital-landscape
4. Nepali Times, "Nepal's interface with information" (NMS 2022 trust and referral figures). https://nepalitimes.com/nepal-s-interface-with-information
5. Spotlight Nepal, "Rethinking formal communications in Nepal's digital era", 1 Aug 2026. https://www.spotlightnepal.com/2026/08/01/rethinking-formal-communications-in-nepals-digital-era-where-should-leaders-speak/
6. Wikipedia, 2021 Nepal census (mother tongue, literacy, province shares). https://en.wikipedia.org/wiki/2021_Nepal_census
7. Kathmandu Post (Ujjwal Acharya), "The challenges of misinformation" (CMR Nepal 2024), 23 Jan 2024. https://kathmandupost.com/columns/2024/01/23/the-challenges-of-misinformation
8. NepaliTelecom, internet speed at peak hours (NTA 6-10 pm window). https://www.nepalitelecom.com/internet-speed-at-peak-hours
9. NepaliTelecom, NPIX traffic peaked at 109 Gbps, June 2026. https://www.nepalitelecom.com/2026/06/nepals-internet-traffic-peaked-109-gbps-during-fifa-world-cup-2026-opener.html
10. Statcounter, mobile screen resolution, Nepal. https://gs.statcounter.com/screen-resolution-stats/mobile/nepal
11. Statcounter, mobile OS share, Nepal. https://gs.statcounter.com/os-market-share/mobile/nepal
12. NepaliTelecom, best phones under Rs 15,000 (2026). https://nepalitelecom.com/best-phones-under-rs-15000-in-nepal
13. r/Nepal, "Block ads on OnlineKhabar", Jan 2020. https://www.reddit.com/r/Nepal/comments/enmieo/block_ads_on_onlinekhabar/
14. r/Nepal, "Nepali news website ad remover", Jun 2022. https://www.reddit.com/r/Nepal/comments/vlyat9/nepali_news_website_ad_remover/
15. r/technepal, "Can anyone create adblocker to block ads from Nepali News website", Jun 2021. https://www.reddit.com/r/technepal/comments/nr4qq6/can_anyone_create_adblocker_to_block_ads_from/
16. GitHub, manishgs/nepali-news-portal-ad-blocker. https://github.com/manishgs/nepali-news-portal-ad-blocker
17. Google Play, Onlinekhabar app reviews. https://play.google.com/store/apps/details?id=com.shirantech.onlinekhabar&hl=en_US
18. Google Play, Hamro Patro app reviews. https://play.google.com/store/apps/details?id=com.hamropatro&hl=en_US
19. Dam et al., Gandaki University, Jagriti 2024, clickbait in Nepali digital media (PDF). https://www.gandakiuniversity.edu.np/wp-content/uploads/2024/09/CH6.pdf
20. The Himalayan Times, "Research finds 3.70 per cent misleading news in Nepali media", 26 Jan 2021. https://thehimalayantimes.com/kathmandu/research-finds-3-70-per-cent-misleading-news-in-nepali-media
21. r/Nepal, "Onlinekhabar is plain biased", Sep 2023. https://www.reddit.com/r/Nepal/comments/168v1a4/onlinekhabar_is_plain_biased/
22. Kathmandu Post, "Here's how the popular Routine of Nepal Banda runs", 19 Feb 2020. https://kathmandupost.com/20/2020/02/19/here-s-how-the-popular-routine-of-nepal-banda-runs
23. Kathmandu Post, "What Routine of Nepal Banda gets right and what it gets wrong", 16 Feb 2026. https://kathmandupost.com/national/2026/02/16/what-routine-of-nepal-banda-gets-right-and-what-it-gets-wrong
24. Nepali Times, "RONB's media model, decade in the making", Jul 2022. https://nepalitimes.com/ronbs-media-model-decade-in-the-making
25. Nepal Check, "How false headlines and thumbnails spread misinformation on YouTube in Nepal", 30 Mar 2023. https://nepalcheck.org/2023/03/30/how-false-headlines-and-thumbnails-spread-misinformation-on-youtube-in-nepal/
26. Kathmandu Post, "In disaster aftermath, Nepal battles a flood of misinformation", 31 Aug 2026. https://kathmandupost.com/national/2026/08/31/in-disaster-aftermath-nepal-battles-a-flood-of-misinformation
27. Kathmandu Post, "Nepal Police warn of scams targeting flood relief donations", 27 Aug 2026. https://kathmandupost.com/national/2026/08/27/nepal-police-warn-of-scams-targeting-flood-relief-donations
28. Onlinekhabar English, NRB notice on PM Disaster Relief Fund accounts. https://english.onlinekhabar.com/nrb-m-disaster-relief-fund.html
29. Kathmandu Post, "24 days after flood, hunger grips three Rasuwa wards", 18 Sept 2026. https://kathmandupost.com/health/2026/09/18/24-days-after-flood-hunger-grips-three-rusuwa-wards
30. Kathmandu Post, "Nepal sent its disaster alert 38 minutes after the glacier collapse. It wasn't enough", 2 Sept 2026. https://kathmandupost.com/national/2026/09/02/nepal-sent-its-disaster-alert-38-minutes-after-the-glacier-collapse-it-wasn-t-enough
31. eKantipur, "Neeraj creates Bhotekoshi flood portal with the power of AI", 3 Sept 2026. https://ekantipur.com/technology/2026/09/03/en/neeraj-creates-bhotekoshi-flood-portal-with-the-power-of-ai-58-15.html
32. LinkedIn, Bishal Khadka (volunteer: "no centralized database of people reported missing"). https://np.linkedin.com/in/bishalkhadka
33. Bernama, Nepal Police missing-person lists, Aug 2026. https://www.bernama.com/en/world/news.php?id=2599969
34. AFP via The Star, "Nepal's wall of missing offers last hope after Himalayan flood", 1 Sept 2026. https://www.thestar.com.my/aseanplus/aseanplus-news/2026/09/01/nepal039s-wall-of-missing-offers-last-hope-after-himalayan-flood
35. Nepal Red Cross Society, Rasuwa Situation Update 5 (PDF). https://website-api.nrcs.org/media/highlights/files/Rasuwa_Situation_Update_5.pdf
36. World Bank, "Harnessing the power of the crowd" (QuakeMap figures), 27 Oct 2015. https://www.worldbank.org/en/news/feature/2015/10/27/harnessing-the-power-of-the-crowd-reflections-six-months-after-the-gorkha-earthquake-in-nepal
37. PreventionWeb, "Standardization of loss and damage datasets on BIPAD". https://www.preventionweb.net/quick/50881
38. Technology Khabar, TikTok monsoon guide linking BIPAD, July 2025. https://www.technologykhabar.com/?p=207589
39. Kathmandu Post via Asia News Network, "Over 458 flood-affected families in Nepal's Saptari left without promised aid", Oct 2024. https://asianews.network/over-458-flood-affected-families-in-nepals-saptari-left-without-promised-aid/
40. Onlinekhabar English, UK diaspora relief collections, 4 Sept 2026. https://english.onlinekhabar.com/?p=588994
41. Annapurna Express (Prakash Bhattarai), loss and damage and ward-level lists, 9 Sept 2026. https://theannapurnaexpress.com/story/66973/
42. Open Data Nepal, National Climate Change Impact Survey 2016. https://opendatanepal.com/dataset/national-climate-change-impact-survey
43. WebsNP, "Nepali Unicode and Devanagari Typography on the Web". https://www.websnp.com/help/nepali-unicode-fonts-website-typography
44. Google Fonts CSS2 API, Devanagari subset sizes (measured 2026-10-14). https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400&display=swap
45. Setopati homepage (BS masthead, DoI registration number; measured 2026-10-14). https://www.setopati.com/
46. eKantipur homepage (BS masthead, "धेरै पढिएका"; measured 2026-10-14). https://ekantipur.com/
47. Onlinekhabar homepage (relative times "११ घण्टा अगाडि"; measured 2026-10-14). https://www.onlinekhabar.com/
48. Hamro Patro, Nepali Keyboard (Romanized transliteration layouts). https://www.hamropatro.com/en/apps/nepali-keyboard
49. ICANN neobrahmigp list, Nepali/Newar LGR and spelling norms. https://lists.icann.org/hyperkitty/list/neobrahmigp@icann.org/thread/JRROYZX6VPIMMK4SK6PI6JZ7SNFKE3L6/
50. ACL Anthology, CHiPSAL 2026, Romanized Nepali prevalence online. https://aclanthology.org/2026.chipsal-1.12/
51. W3C, Indic Layout Requirements (Working Draft). https://www.w3.org/TR/ilreq/
52. UNICEF Nepal, launch of Dina (दिना) Nepali text-to-speech voice, 3 Dec 2024. https://www.unicef.org/nepal/press-releases/unicef-and-atscale-launch-nepali-text-speech-digital-voice-dina-%E0%A4%A6%E0%A4%BF%E0%A4%A8%E0%A4%BE-enhance
53. Internet Society, DoIT portal accessibility audit (WCAG 2.2 AA), 2026. https://news.internetsociety.org/?p=37907
54. Republica, government websites and the MoCIT accessibility directive. https://myrepublica.nagariknetwork.com/news/all-govt-websites-now-made-accessibility-friendly-90-67.html
55. Similarweb, onlinekhabar.com (Sept 2026 data). https://www.similarweb.com/website/onlinekhabar.com/
56. Similarweb, hamropatro.com (Sept 2026 data). https://www.similarweb.com/website/hamropatro.com/
57. Ratopati English, Hamro Patro remittance passes Rs 100 million in a month, 6 Jun 2022. https://english.ratopati.com/story/24734/hamro-patro-remittance-100-million-one-month
58. TechCrunch, "Nepal blocks Facebook, Instagram, YouTube, X over rule breach", 4 Sept 2025. https://techcrunch.com/2025/09/04/nepal-blocks-facebook-instagram-youtube-x-over-rule-breach-amid-censorship-concerns
59. NepaliTelecom, Nepal Telecom Viber community during the block, Sept 2025. https://www.nepalitelecom.com/2025/09/nepal-telecom-viber-community-contact-for-grievances.html
60. CMR-Nepal / NepalFactCheck.org, "Misinformation during the Gen Z Uprising in Nepal" (PDF), Oct 2025. https://research.butmedia.org/wp-content/uploads/2025/10/GenZ_Protest_Misinformation_Report.pdf
61. The Himalayan Times, "Nepali media faces sustainability crisis, says report" (Freedom Forum 2023 data), 2 Jan 2024. https://thehimalayantimes.com/kathmandu/nepali-media-faces-sustainability-crisis-says-report
62. Kathmandu Post, "Note from Group Editorial Director" (Kantipur One subscription), 25 Aug 2026. https://kathmandupost.com/opinion/2026/08/25/note-from-group-editorial-director
63. The Record, "A message from the founders" (extended hiatus), Jul 2022. https://recordnepal.com/a-message-from-the-founders-of-the-record
64. eKantipur, "Online media registration fees: regulating or curbing freedom" (2025 Press and Publication Rules), 9 Nov 2025. https://ekantipur.com/news/2025/11/09/en/online-media-registration-fees-regulating-or-curbing-freedom-15-27.html
65. AHN Legal, "Online media regulation in Nepal" (2017 Directive summary). https://www.ahnlegal.com/legal-updates/legal/online-media-regulation-in-nepal
66. Lawalpine, "Online media registration in Nepal" (2026). https://lawalpine.com/blog/online-media-registration-in-nepal
67. Setopati English, Electronic Transactions Act Section 47 text and penalties. https://en.setopati.com/political/165095
68. Article 19 / Media Action Nepal, UPR submission on Nepal (PDF), 2025. https://www.article19.org/wp-content/uploads/2026/01/UPR-Nepal-7.2025-A19_MAN.pdf
69. CPJ, Nepali journalists Aishwarya Kunwar and Puskar Bhatt arrested under cybercrime law, Feb 2024. https://cpj.org/2024/02/nepali-journalists-aishwarya-kunwar-puskar-bhatt-arrested-under-cybercrime-law/
70. Kathmandu Post, "Government moves to withdraw Social Media Bill", 7 Feb 2026. https://kathmandupost.com/national/2026/02/07/government-moves-to-withdraw-social-media-bill
71. Asia News Network / Kathmandu Post, Sidhakura contempt sentences, Sept 2024. https://asianews.network/?p=168780
72. eKantipur, Press Council Nepal "Editorial Guidelines for Humane and Responsible Disaster Reporting, 2083" (English summary), 4 Sept 2026. https://ekantipur.com/news/2026/09/04/en/clear-disclosure-is-required-when-using-ai-generated-symbolic-imagery-04-46.html
73. Republica, Minister Timilsina urges media to protect dignity and privacy of Bhotekoshi flood-affected children. https://myrepublica.nagariknetwork.com/news/minister-timilsina-urges-media-to-protect-dignity-privacy-of-bhotekoshi-flo-12-87.html
74. The Himalayan Times, UN in Nepal statement on Rasuwa flood coverage and missing-person photos, Sept 2026. https://thehimalayantimes.com/ampArticle/1040196
75. National Penal Code 2074, Section 295 (photographs without consent). https://nepallaws.com/Laws/the-national-penal-code-act-2074/part-3-offences-against-individual-privacy-and-prestige/chapter-1-offences-against-privacy/section-295-prohibition-of-taking-or-disfiguring-photograph-of-any-person-without-his-or-her-consent/
76. Pioneer Law, Individual Privacy Act 2018 (2075). https://pioneerlaw.com/individual-privacy-act-2018-2075
77. eKantipur, "163 complaints registered with Press Council in 6 months", 22 Jan 2026. https://ekantipur.com/news/2026/01/22/en/163-complaints-registered-with-press-council-in-6-months-48-41.html
78. Freedom Forum, Annual Press Freedom Report 2026 (news 840). https://freedomforum.org.np/news/detail/840
79. Freedom Forum, online harassment survey of 100 journalists (news 674), Jul 2022. https://freedomforum.org.np/news/detail/674
80. Ratopati English, Advertisement Board listing required for public-welfare ads, 2026. https://english.ratopati.com/story/77190/newspapers-that-do-not-list-and-renew-their-advertising-on-the-advertisement-board-will-not-receive-public-welfare-advertising-funds
81. Kathmandu Post, "Nepali media is fighting for survival; its journalists are fighting for their paychecks", 15 Apr 2026. https://kathmandupost.com/money/2026/04/15/nepali-media-is-fighting-for-survival-its-journalists-are-fighting-for-their-paychecks
82. Kathmandu Post, "Nepal moves against online abuse targeting flood victims", 7 Sept 2026. https://kathmandupost.com/national/2026/09/07/nepal-moves-against-online-abuse-targeting-flood-victims
83. Freedom Forum, Ukeraa CMS breach (news 692), Dec 2024. https://www.freedomforum.org.np/news/detail/692
84. Republica, complaints filed against 699 information officers (RTI, 54 of 753 local levels responded). https://myrepublica.nagariknetwork.com/news/complaints-filed-against-699-officials-not-providing-information
85. Nepali Times (Upasana Khadka), "From letters to landlines, phones to Facebook", 17 Aug 2020. https://nepalitimes.com/from-letters-to-landlines-phones-to-facebook
86. B360 Nepal, remittance inflows FY 2025/26 (NRB). https://www.b360nepal.com/detail/29887/remittance-inflows-to-nepal-surge-371-pc-to-over-rs-2363bn-in-fy-202526-nrb
87. Semrush, onlinekhabar.com overview (traffic by country). https://www.semrush.com/website/onlinekhabar.com/overview/
88. Nepali Times, "Nepalis are drifting to digital media" (NMS 2019; radio bulletin habit), 12 Apr 2019. https://nepalitimes.com/nepalis-are-drifting-to-digital-media
89. Nieman Reports, "Nepal's Gen Z protests", 19 Sept 2025. https://niemanreports.org/nepal-gen-z-protests-memes-discord-revolution-oli-one-piece/
90. Kathmandu Post column, "Nepal floods: a preventable disaster", 5 Aug 2025. https://kathmandupost.com/columns/2025/08/05/nepal-floods-a-preventable-disaster
91. PreventionWeb, "Nepal's devastating floods: 10 seconds could save lives". https://www.preventionweb.net/news/nepals-devastating-floods-10-seconds-could-save-lives
92. Nikita Chaudhary, Medium, Koshionline UX/UI redesign case study, Jul 2021. https://nikita-design.medium.com/case-study-ux-ui-redesign-of-nepali-news-portal-koshionline-dd5581c22f97
93. eKantipur, "Female journalists hit by trolling and doxxing", 2 Jan 2026. https://ekantipur.com/news/2026/01/02/en/female-journalists-hit-by-trolling-and-doxxing-06-12.html
94. NepaliTelecom, commentary on DataReportal 2026 (voice/SMS-only connections), May 2026. https://www.nepalitelecom.com/2026/05/only-56-percent-use-intermet-in-nepal-sharp-reality-vs-expection-in-datareportal-figures.html

Local documents:

95. `docs/NEWS-PORTAL-DECISIONS.md` (owner decisions, updated 2026-10-14): storage, scope, pre-moderation, per-item language, reporter role, public naming, display tiers, ads, rollout, empty localities, build order, DoIB note.
96. `docs/public-audit-2026-10/council-verdict.md` (2026-10-14), with `council-question.md`, `council-advisors.md`, `council-reviews.md`: the "checked record" reframe, Phase 0-3 sequence, blind spots, and the factual corrections honoured in this report.
97. `docs/public-audit-2026-10/research_notes/Nepali online news audience/verified_nepal_public_site_inventory.md`: current-site inventory, used only as background.
