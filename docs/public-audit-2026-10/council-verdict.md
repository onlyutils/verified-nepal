# Council verdict: the public side of Verified Nepal (2026-10-14)

Chairman's synthesis of five advisors (Contrarian, First Principles, Expansionist, Outsider, Executor) and five peer reviews, judged against `docs/NEWS-PORTAL-DECISIONS.md` as updated 2026-10-14 (pre-moderation; VerifiedNepal registers with DoIB) and `verified_nepal_public_site_inventory.md`.

## Where the Council Agrees

1. **Supply is zero and the empty room falsifies the brand.** All five, independently: prod returns `{"items":[]}` for articles, stories, projects, centres and incidents; `/stories` is a 404; `/articles` shows "Write an article" above "No articles match". A verification brand with nothing to check is a contradiction on first visit.
2. **The home page is frozen on 26 August.** NDRRMA snapshot `synced_at 2026-08-29`, centres `last_verified 2026-09-08`, `llms.txt` still a single-flood dashboard, while the status bar says "Live". C, E, B and D all call this the most urgent credibility leak; A implies it.
3. **The unique, defensible asset is the aid/transparency stack, not prose.** `/ledger`, `/coverage` (3W export), `/audit`, mandatory `Source:` lines, Live/Snapshot badge, "never handles money". C, D, E and A all list it; nobody else in Nepal tracks needs → delivery at ward level, and it cannot be forged with a logo.
4. **"Verified" must collapse to one meaning.** Five senses today (inventory §8); A, C, E and B each flag it.
5. **Do not build the full local-updates spec first.** A and D want step 1 / the "Now" strip only; C and E want none of it. Nobody endorses 753 locality pages before one municipality has content.
6. **Do not build** comments, push, dark mode, the AI writer, condolences or the ad-manager role now (A explicit; C, E by posture; no dissent).
7. **Nepali-first, dated, sourced, short, shareable** is the ideal item shape (B, D, E, A).

## Where the Council Clashes

**Magazine vs ledger.** A would fill `/articles` with owner-written pieces and add a latest block, RSS, BS dates. C and E say stop spending on articles entirely and re-cut local updates as `kind: claim`. B wants empties hidden. D splits the difference: feed a "Confirmed today" strip from data the site already ingests. Reasonable advisors disagree because they weigh different bottlenecks: A sees a writing problem, C/E see a positioning and legal problem, D sees a distribution problem. Four of five reviewers backed D. The Chairman agrees: the unit of content is the dated, located, sourced *item*, not the article; articles survive only as evergreen explainers.

**Stop vs ship.** C says stop until a lawyer signs off and a 30-day supply test passes. Review 4's rebuttal is decisive: C's cure has the disease it diagnoses, since "stop" produces nothing citable and ward chairs are not users yet. Ship, but ship the honest minimum.

**DoIB posture.** A: register later when there is a month of content. C/E: a volunteer operation cannot register, so never be a portal. Owner: VerifiedNepal registers. Under the corrected facts, **C/E's moderation argument is moot** (pre-moderation chosen) and **their "never register" argument is overruled**, but one point survives intact: the 2025 rules need a company or firm with PAN/VAT, a qualified named editor, at least three employees and a written commitment to bank-paid salaries (publisher note KQ1). Registration is a legal entity and a payroll, not a Rs 5,000 form. A's "later" is therefore not a sequencing choice; until the entity exists, the pre-moderated, non-commercial, "local updates" posture is the only defence. That makes build-order step 4 (ad slots) the one item that must wait for registration: labelled ads on news-like items before registration is the worst of both positions.

**Owner writes the content.** A's step 1 is "write five articles yourself". Reviews 2, 4 and 5 object that it is online journalism by one anonymous person and reproduces the exact bottleneck that produced zero items. Both are right about different things: the owner should not be the news supply, but owner-written *explainers* (how relief works, how to read a bulletin, how to use the ledger) are the evergreen layer Review 4 asked for and carry no news exposure.

## Blind Spots the Council Caught

- **The reader's intent is a question, not a feed**: "does my palika have X?" Nobody specified the query path. The picker needs Roman-Nepali input and Nepali-digit/spelling normalisation; cross-script person search returns nothing today (CONTRIBUTOR-TODO §2).
- **Performance for 360px/4G**: SW precaches 124 files including the 1.5 MB `rescued-persons.json` on first visit; Leaflet + Esri tiles on home; 0.5-0.9 MB of fonts. Only A touched fonts.
- **55% non-Nepali mother tongue, Madhesh (20% online news), women's literacy 69%, Dina TTS/TalkBack**: "default to Nepali" is necessary but not sufficient; audio or TTS-friendly markup matters.
- **Facebook and dark social are the distribution surface** (90% reach; 69-83% direct traffic). `Organization.sameAs` lists only GitHub; no owned page, no Viber share. The site wins as the citation target, not the destination.
- **Cadence**: a 6-11 pm daily bulletin, and an answer for Falgun when there is no flood. Relief delivery is not a daily beat.
- **The unused asset**: `/flood-impact` is the only non-empty, unique reading surface and nobody anchored on it.
- **The ledger's own exposure**: a public record that Ward 3 was not reached names a CDO; PCN now reaches non-media accounts (72 takedown orders, Aug 2026). Record deliveries as facts; never editorialise absence.
- **PCN 2083 guidelines and a corrections log**: cheap trust markers nobody proposed; the Desk rule card should carry them.
- **The Rasuwa ward-chair anecdote** is the sole evidence for the ledger pivot and the note marks the tool idea as inference.
- **Overstatements** (see last section).

## The Recommendation

Verified Nepal's public side should become **Nepal's checked record**: a Nepali-first status board of short, dated, located, sourced items, backed by the ward ledger, distributed as cards into Facebook/WhatsApp/Viber, with "local updates" as the pre-moderated human layer feeding the same strip. Not a magazine, not a portal.

Sequence, for one owner plus volunteers:

**Phase 0, honesty (this week, no new feature).** Un-hardwire `/` from the August flood; show every date as relative time plus BS date, and label the snapshot as a snapshot. Hide `/articles`, `/projects`, `/incidents` from nav while their API returns zero (keep routes; move "Write an article" behind sign-in). Remove the `/stories` link. Cut the hamburger to six: Now, Get help, Give help, Find someone, Drop centres, Ledger. Default to Nepali on first visit. Rewrite the hero in shopkeeper words; delete the "explicit name search" sentence; fix the `/search` contradiction. Two words only: "Official source / आधिकारिक स्रोत" for OPMCM/NDRRMA items, "Checked / जाँच गरिएको" for anything that passed moderation. Link GOVERNANCE and MODERATION-GUIDELINES; add a corrections line and PCN 2083 checklist to the Desk rule card. Drop `rescued-persons.json` from the SW precache; self-host two Devanagari weights.

**Phase 1 = build-order step 1 plus its public face.** `kind: news` + validator + Desk queue as decided, and a home "Now" strip fed from four sources: OPMCM items already pulled, drop-centre verifications, ledger deliveries, and published `kind: news` items. Every row: place, happenedAt, source link, relative time, EN/ने chip. Each row renders as a PNG share card via the existing `ShareButton` pipeline, with Viber added to WhatsApp/Facebook. Open an owned Facebook page and post the cards at 6-9 pm daily. Promote `/flood-impact` and `/ledger` into the strip as standing entries.

**Phase 2 = build-order step 2**, gated on one municipality holding ten published items. The picker is where Roman-Nepali input lands.

**Phase 3 = step 3** (reporter role) as decided.

**Step 4 (ads) waits for the DoIB certificate.** In parallel, starting now: confirm fees, editor and staffing rules with DoIB directly, and form the entity; this is the gating item for the words "news", "reporter" and for any ad.

Keep: hotlines, privacy page, no-money principle, `/ledger` `/coverage` `/audit`, `/flood-impact`. Demote: `/climate` and `/our-message` out of primary nav (owner to decide retire-or-keep explicitly). Stop: volunteer hours on climate-magazine articles; AI writer, condolences, ad manager, comments, push, dark mode, Nepali URLs/hreflang, SSR.

## The One Thing to Do First

Replace the hard-wired August block on `/` with a dated, sourced "Now" strip fed from what the site already ingests (OPMCM items, centre verifications, ledger deliveries), one row per item with place, source link and relative time. It fixes the staleness lie, gives the first shareable card, and is the public face of build-order step 1 before a single reporter exists.

## Factual corrections to carry into the reports

- **E**: "100 closing per year" is one year (2023) across all media, not an annual rate of online portals.
- **C**: The Record did not "die"; it announced an extended hiatus in July 2022 and its archive is live.
- **C, E, Reviews 1/2/5**: post-moderation, "Not yet checked" labels, tiers and strikes are dropped; local updates are pre-moderated. Arguments against post-moderation are moot.
- **C**: "the lawyer's opinion the owner already decided to get" is not in the current decisions doc; it now says confirm fees and editor rules with DoIB directly.
- **A**: DoIB registration is not "spend the Rs 5,000"; it requires a company/firm with PAN, a named qualified editor, at least three employees and bank-paid salaries.
- **E**: "A volunteer operation cannot legally be a news portal. Full stop." is overstated; the owner's chosen path (a registered entity with contributors) is lawful if the entity and staffing exist. The note's actual claim is that a *pure volunteer* operation cannot meet the salary commitment.
- **Review 4**: "/ledger, /coverage and centres are as empty on prod as /articles" is only confirmed for centres; the inventory does not record ledger or coverage row counts. Treat as unverified.
- **D**: `/search` is `noindex` and robots-disallowed deliberately for privacy; un-indexing it conflicts with PCN 2083 and the Penal Code consent concerns. "Beats the state" overstates a search over NDRRMA's own lists.
- **Review 1**: A's five articles were "from NDRRMA bulletins and Trishuli imagery", not "climate-magazine" pieces.
- **All**: the ward-chair adoption hook rests on one Kathmandu Post report and is marked as inference in the disaster note; present it as a hypothesis to test, not evidence.
