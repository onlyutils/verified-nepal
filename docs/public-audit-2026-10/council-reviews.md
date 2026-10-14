# Council round 2: anonymised peer reviews (mapping: A=Executor, B=Outsider, C=Contrarian, D=Expansionist, E=First Principles)

## Review 1 (asked to look for reader UI/UX and persona gaps)

Facts check out (prod `{"items":[]}`, `/stories` 404, `/search` noindex, cross-script search returns nothing, `synced_at 2026-08-29`).

**1. Strongest: C**, narrowly over E. Both reframe correctly (verification role = provenance record, not a 101st portal; ward-level needs→delivery is the only unique, defensible, evidenced asset), but C is the only one that names the two things that can actually hurt the owner now: the "live" counters/`synced_at 2026-08-29` make the brand anti-verification, and the decisions doc's switch to *post*-moderation + ad slots abandons the posture that keeps it out of DoIB. Its 30-day supply test is a cheap, falsifiable gate. A is the best execution plan but has the wrong thesis (five climate-magazine articles will not make anyone "verify here"). E's `kind: claim` schema is the best concrete build idea; D oversells monetisation.

**2. Biggest blind spot: A.** It treats content as a writing problem and ignores the legal posture entirely ("register when there's a month of items" is backwards: a month of published news is the exposure), and it never checks whether anyone would open the link once shared.

**3. All five missed:**
- The reader's intent is a question, not an item: "does my palika have X?" Nobody specified the query path (palika picker, Roman-Nepali input, Nepali-digit normalisation).
- Performance for the 360px/4G reader: nobody flagged the SW precaching 1.5 MB JSON on first visit or Leaflet on home; only A touched fonts.
- Accessibility/TTS (MoCIT directive, Dina TTS), women's 69% literacy and Madhesh (Maithili/Bhojpuri): 44.9% Nepali-mother-tongue means "default to Nepali" is not enough.
- Personas unaddressed by anyone: journalist (citable permalinks + corrections log + embed), moderator capacity for 753 localities, local government as *author* (ward chair posting), donor/NGO (3W consumers) got one line from D. Diaspora as readers at Gulf evening = Nepal midnight; nobody noted the time-zone mismatch with the 6-11 pm peak.
- PCN humane-reporting rules (no faces of the dead, AI-image labelling) as a built-in moderation checklist.

## Review 2 (asked to look for legal exposure, capacity, contradictions)

**1. Strongest: D.** It makes the same reframe as C and E (the asset is the ward ledger, not a magazine) but, unlike C's "stop", gives a buildable first move that uses only what exists: a "Confirmed today" strip fed from OPMCM items, centre verifications and ledger deliveries, shipped as share-card PNGs with the badge baked in. That fits discover-on-Facebook/verify-elsewhere, needs no reporters, and never says "news". Discount its diaspora-pays coda; it's speculation.

**2. Biggest blind spot: A.** It treats the problem as content supply plus eight half-day features. "Write five articles yourself from NDRRMA bulletins" is online journalism by the 2017 directive's definition, and "register with DoIB later" is impossible: the 2025 rules require a company with PAN, a named editor and three bank-salaried staff (publisher notes KQ1). A volunteer cannot register, so "later" never arrives. It also green-lights local-updates step 1 while the decisions doc itself says lawyer first.

**3. What all five missed:**
- They contradict each other and nobody says so: A fills /articles, B/E hide it, C/E stop it. A builds local updates, C/D/E don't. The owner must pick magazine or ledger; one person cannot run both.
- The ledger has its own exposure. A public record that relief did *not* reach Ward 3 names a CDO or ward chair: defamation and ETA s.47 bait, and PCN now reaches non-media accounts through the Cyber Bureau (72 takedowns, Aug 2026). D also wants /search un-noindexed; PCN 2083 and Penal Code 295-296 imply family consent and pulling resolved listings.
- Who fills the ledger? Ward chairs logging deliveries is field outreach, not code; volunteers produced zero items at peak demand. B wants a named owner; nobody proposes the legal shell (NGO, or syndication to a registered FM/outlet) that makes a name safe to publish.

## Review 3 (asked to look at distribution and whether text-first can compete)

**1. Strongest: D.** It is the only response that treats distribution as the product rather than a share button. Its "Confirmed today" strip fed from data the site already pulls (OPMCM, centres, ledger deliveries), rendered as shareable PNG cards via the existing share-card pipeline, is the one plan that reaches readers where they are (Facebook/WhatsApp/Viber, 69-83% dark-social traffic) without new supply, new liability or a DoIB trigger. It also names the diaspora/3W monetisation path. E is the sharpest on legal posture and should be merged in; A is the most executable but assumes articles are the right unit.

**2. Biggest blind spot: A.** It is a build list for a destination website. "Write five articles yourself", RSS, BS dates, a latest block: all presume readers arrive at verifiednepal.com and read text. The evidence says they discover on Facebook, trust video and RONB-length posts, and read online news at 20% in Madhesh. A also treats a Nepali-URL/SEO backlog as sequencing, not strategy, and never asks whether the owner can sustain a weekly article cadence after the "three writing days". Its DoIB advice ("register when there's a month of items") concedes it is building a news portal.

**3. All five missed:**
- Facebook/YouTube as the primary surface: nobody proposes an owned Facebook page, Viber community or YouTube/short-video output, despite 90%/82.6% reach and the video-first shift. The site should be the citation target; the feed is the channel.
- The 6-11 pm evening peak as a publishing cadence (one daily "confirmed" bulletin).
- Audio/video and Dina TTS for the 24% non-literate and low-literacy women.
- Diaspora time zones (Gulf) and Roman-Nepali input beyond search.
- Whether text-first can compete at all: only D gestures at it. Nobody said the honest answer: a text site wins as the reference others cite, not as a destination.

## Review 4 (asked about over-fitting to the flood, quiet months, existing content)

**1. Strongest: D.** It answers all three parts and makes the one move nobody else does: feed a "Confirmed today" strip from data the site *already ingests* (OPMCM/NDRRMA items, centre verifications, ledger deliveries) so the front page is never empty regardless of volunteer writing output. A is the best execution plan (file-level, costed, correct supply-first order) but its step 1 is "owner writes five articles", which is the exact bottleneck that produced zero items at peak demand. Pair D's thesis with A's build list. D's diaspora-pays layer is speculative; ignore it.

**2. Biggest blind spot: C.** Its cure has the disease it diagnoses: `/ledger`, `/coverage` and centres are as empty on prod as `/articles`, and ward chairs are not users yet. "Stop" produces nothing to cite. C and E also argue against post-moderation and DoIB registration, but `NEWS-PORTAL-DECISIONS.md` (updated 2026-10-14) records the owner already chose pre-moderation and that VerifiedNepal itself registers; the "lawyer" C cites is not in the doc. B is the only reader-seat view and should not be discounted, but it ignores legal posture entirely.

**3. What all five missed.**
- Every proposal is a disaster-mode product. Monsoon is over; the next flood may be months out. None answered what the daily 6-11 pm check is in Falgun. RONB's beat is daily; relief delivery is not.
- Nobody uses the content already paid for. `/flood-impact` is the one unique, non-empty reading surface and no one made it the anchor; articles could be the evergreen layer for quiet months (how relief works, how to prepare); climate/our-message need an explicit keep-or-retire call, not silence.
- Nobody read the 2026-10-14 decisions before giving legal advice.

## Review 5 (asked to fact-check)

**1. Strongest: D.** It resolves the council's real split (A: "ship content"; C/E: "stop, it's a news portal") by feeding a "Confirmed today" strip from data the site already ingests (OPMCM, NDRRMA, centre verifications, ledger deliveries) rather than from volunteer prose that produced zero items in six weeks. Its facts check out: RONB 9.5M cross-platform (pain-points note), Hamro Patro 1.7M DAU and Rs 100M remittance month (portal_traction §116), `/search` noindex (inventory §37). A is the best execution plan and its inventory cites (stories strip hidden at `home.tsx:380`, `/feed.xml` → SPA shell, no Viber) are all correct, but see below.

**2. Biggest blind spot: A.** It treats DoIB as "spend the Rs 5,000 when there is a month of items". Registration requires a company with PAN, a named editor and three bank-paid staff (publisher note §17, §115). That is the exact legal wrong call the question warns about, and step 8 builds the news feature anyway. It also has the owner author five articles himself, which collapses "community-verified" into "one anonymous person". B shares the gap: no legal posture, and "put a named person and phone in the footer" invites ETA s.47 exposure.

**3. What all five missed.**
- C, D and E all rest the ledger pivot on one anecdote (Rasuwa ward chairs, Kathmandu Post 18 Sept); the note itself marks the tool idea as inference (disaster note line 320). Thin evidence for a strategic pivot.
- Nobody treats Facebook as the distribution surface despite 90% reach; `Organization.sameAs` lists only GitHub.
- Nobody mentions PCN's 2083 disaster guidelines or a corrections log, both cheap trust markers.
- Non-Nepali mother tongues (55%), Madhesh, women's literacy and TalkBack/accessibility are absent.
- Overstatements: E's "100 closing per year" (one year, all media); C's "The Record died" (hiatus).
