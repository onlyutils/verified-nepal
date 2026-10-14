# Council transcript round 2: language, news vs article, AI news writer (2026-10-13)

# The question (round 2)
## Context: this is round 2
Round 1 (same day) counciled a news-portal extension for VerifiedNepal (verifiednepal.com): a volunteer-run, bilingual (English/Nepali), mobile-first disaster-response and mutual-aid platform for Nepal whose brand is "verified, not viral". Round 1 verdict, which the owner has read:
- First slice: add municipality + ward to the existing ARTICLE items (internally "DISPATCH": draft/pending/published/rejected, moderator-approved on "The Desk"), a locality GSI, a `/local/<municipality>` page, reader picks their area once, tiers Ward -> Municipality -> District -> Nepal with empty-tier collapse.
- Reporters = "local correspondent" role on USER with a home locality, approved on the Desk; articles still go through moderation.
- No public points; private tally + public profile instead. Condolences deferred to month 2. Ads = two labelled slots from an admin-only AD item; no ad-manager role or payments until there's an audience.
- Blind spots caught: moderation throughput (753 localities would swamp a volunteer Desk), empty-feed problem, old-VDC names in the picker, possible Department of Information and Broadcasting registration for "online news portals", cold-start supply.

## The owner's response and the three NEW decisions for this round
The owner accepted locality-on-articles. They then made three statements that change the design:

1. **Language.** "The reporter can write in any language, and it will be displayed in that manner for people reading it." I.e. no translation requirement; a Nepali-only post is shown as Nepali-only. (Note: the codebase ALREADY stores articles single-language: each DISPATCH has a `language` of "en" | "ne" and title/body keyed by that language, so this is largely already true. The open question is only display: the site has a global EN/NE toggle, and local feeds will mix languages.)

2. **News is not the same as articles.** "We also need to write news and publish news with the locality. Article and news are different things." The owner wants a distinct NEWS content type alongside ARTICLE (long-form, block editor, 1-3 tags from a fixed list: climate, mountains, floods, landslides, glaciers, community, story) and STORY (photo/video + caption). The council must decide: what makes news different from an article in this product (format? speed? moderation path? lifetime? display?), whether it should be a separate DynamoDB item type or a flag/kind on DISPATCH, and how the three types coexist in the locality feed and on the Desk without tripling moderation work.

3. **AI news-writer portal.** "We need an AI-driven news writer portal where the reporter can drop the news link or news text of other portals, and AI will merge them and curate the same news including all the aspects from the input (link/text), and the reporter will publish that news." I.e. a reporter pastes 1..N URLs or raw text from other Nepali news sites; an LLM fetches/reads them, merges them into one curated news item covering every aspect in the inputs; the reporter reviews and publishes. The council must judge this: value vs. risk (copyright and attribution of other portals' reporting, hallucination/merged-facts errors, the "verified" brand publishing AI-rewritten third-party news, cost per generation, abuse by high-volume reporters), and how to build it if at all (fetch pipeline, prompt design, mandatory source list, moderation, rate limits).

## What already exists technically
- Backend: Node 22 Lambda, single-table DynamoDB, route tables + withAuth wrappers; Lambda concurrency capped at 10 per account (increase pending). Free-tier-ish budget.
- No server-side LLM call exists anywhere yet. The only AI is a client-side OnlyUtils chat widget. An LLM integration would be new code, new secret, new cost line.
- Media upload via OnlyUtils presign. OG share cards per article. First-party reach counters per page.
- Roles: helper | moderator | admin; moderators are district-scoped. Public audit log of every moderator action.
- Owner delegates implementation to Codex/Claude in slices; limited volunteer dev time.
- Nepal: most readers on Android on slow data; local news today is Facebook pages and regional portals (Setopati, Onlinekhabar, Kantipur, Ratopati etc.) that do their own reporting. Nepali copyright law (Copyright Act 2059) protects news articles as literary works; fair-dealing exceptions are narrow.

## What's at stake
Round 1 said the product's moat is trust, not features. An AI tool that rewrites other portals' news could either make a tiny volunteer team look like a real newsroom, or turn "verified, not viral" into "AI-remixed, unattributed" and invite takedown demands or hallucinated facts about real people during disasters. The owner must decide the shape of NEWS, the language display rule, and whether/how to build the AI writer.

# ADVISOR RESPONSES

## The Contrarian (Response D)
**Language.** The hidden failure isn't display, it's the toggle. If the EN/NE toggle filters a locality feed, a ward with three Nepali posts and one English post shows an English reader an empty page, and empty-feed was already round 1's biggest blind spot. If it doesn't filter, the toggle is a lie for the content it ostensibly controls. Pick one: the toggle governs chrome only, feeds always show everything, and each card carries a language badge. Also notice nobody has asked who proofreads Devanagari. Moderators are district-scoped, not language-scoped; a Nepali-only moderator will rubber-stamp English posts and vice versa.

**News vs article.** The owner said "different things" but gave no attribute that differs. Ask what a reader does differently with news. If the answer is "it's shorter and faster," that's a *length and a deadline*, not a type. A separate item type triples Desk tabs, GSIs, OG cards, reach counters and sitemap routes while the moderation queue, the actual bottleneck, grows the same either way. Worse: "fast" news plus "moderator-approved" is a contradiction; news that waits 14 hours for a volunteer is a stale article with a different label. Either news gets a lighter path (which destroys "verified") or it doesn't (which makes it an article). Make it `kind: "news"` on DISPATCH with a required `happenedAt` and a 7-day feed decay; ship nothing else until the owner names a real difference.

**AI writer.** This is the one that kills the brand. The product's entire moat is "verified"; the tool's output is by construction unverified: it's a summary of other people's reporting, with no one in the chain who witnessed anything. During a landslide an LLM merging two portals that disagree on a death toll will silently pick one or invent a third, and VerifiedNepal publishes it under a correspondent's name. Copyright Act 2059 gives Kantipur a clean takedown; attribution doesn't cure derivative works. Cost and the 10-concurrency Lambda cap mean a 30-second fetch-and-generate call blocks the Desk. Abuse is trivial: a reporter pastes ten links a day and the "local correspondent" becomes a content farm. Build at most a "sources" field on news (URL list, rendered as links) and nothing that writes prose. If the owner insists, the only defensible version is a *summarizer that cannot publish*: output goes to a private draft, every sentence must cite a source URL, and moderators see a diff against the inputs. That is a month of work for a feature that makes the site look less trustworthy.

## The First Principles Thinker (Response B)
Strip the three questions down and they are one question: what is VerifiedNepal actually for? Answer: it is a trust layer over a disaster. Not a newsroom. Every decision falls out of that.

**Language.** You're asking a display question, but the real question is "what is the unit of trust?" It's the post, not the site. So the language of a post is the post's language, full stop. The global EN/NE toggle should govern chrome (nav, labels, buttons) only, never filter or hide content. A Nepali-only ward report hidden behind an EN toggle is a verified fact nobody saw. Render the `language` field as a small tag, set `lang=` on the element for screen readers and font fallback, and move on. Zero new schema.

**News vs article.** The owner says they're "different things" but hasn't said how, and you're about to build a type around a feeling. From first principles, what differs in a disaster platform is not format, it's time-to-truth. An article is reflective; a news item is a dated, short, source-bearing claim that goes stale. That's three fields on DISPATCH (`kind: news|article|story`, `happenedAt`, `sources[]`), not a new item type. Same moderation path, same locality GSI, same feed sorted by `happenedAt`. If news needs a faster path, the lever is a "trusted correspondent auto-publish with post-hoc review", not a second table. A separate type triples the Desk; a kind field costs one filter chip.

**AI news writer.** Wrong question. "Should we merge other portals' reporting?" presupposes that reporting other portals' reporting is the product. It isn't. Setopati already exists. The only thing VerifiedNepal can add to a Kantipur story is a verification mark it cannot honestly give, since it didn't do the reporting. So the AI-rewriter produces content you can't verify, from sources you don't own, under a brand whose single asset is "verified". It is negative-value even if it works perfectly.

What the underlying need actually is: correspondents are slow at writing. Solve that. Let them paste their own notes or a voice memo and have an LLM tidy it into a draft in their language, with links to other portals rendered as plain "see also" citations, never ingested. That's one Lambda, one prompt, one secret, capped at N per correspondent per day. Build that, and never the merger.

## The Expansionist (Response E)
**Language: don't toggle, fork.** The EN/NE switch is a filter today; make it a growth lever. Show every item in its written language, and treat each language gap as an inventory of translation work: "This story is Nepali-only — translate it" becomes a volunteer task on the Desk, feeding the diaspora reader (Qatar, Malaysia, Australia, the Gulf remittance corridor) who is the one audience with money and no local news in English. That diaspora is also the ad buyer and the donor nobody in round 1 priced in. Mixed-language feeds aren't a bug; they're the bilingual moat Setopati can't copy.

**News: a kind on DISPATCH, but its own clock.** What makes news different isn't editing — it's time. News is short (headline, two paragraphs, one photo), ward-stamped, posted in minutes, and decays: it auto-expires from the "now" strip in 48 hours and archives. That decay is the upside: an expiring, locality-stamped news stream is a *structured disaster timeline* — the dataset BIPAD, DDMCs, and INGOs would pay for or integrate with, because nobody in Nepal has ward-level, timestamped, human-verified incident logs. Reuse the DISPATCH item with `kind: news`, lighter moderation (trusted correspondents auto-publish, moderators review after), and you get the 3W/one-door work from the org slices for free.

**AI writer: build it, but invert the product.** Rewriting portals is the small version. The big version is a *source aggregator* that sits on top of the locality feed: a reporter pastes links, the model extracts facts, dates, numbers, named places, and produces a cited brief where every sentence links to its origin — "Onlinekhabar reports 3 houses; Kantipur reports 5." That isn't plagiarism; it's the conflict detector that *proves* the "verified" brand. Attribution becomes the feature, and the diff between sources is the headline. Later this is the pipeline for drone imagery, BIPAD feeds, and SMS reports — the same merge step. Cost is trivial at Nepal volume; the win is being the layer every other portal gets cited through.

## The Outsider (Response A)
I'm an ordinary reader in Pokhara on a cheap Android. Three naive questions.

**Language.** If I flip the toggle to Nepali, why am I still seeing English posts? That is what mixing looks like to me: a broken toggle. Don't filter by the toggle; the toggle changes the chrome, the feed shows everything, and each post carries a small "EN" or "ने" chip so I know before I tap. Also: a Nepali-only post with an English headline in the share card, or vice versa, will look machine-made. Whatever language the reporter wrote in, every surface of that post stays in it.

**News vs article.** Honestly, I cannot tell you the difference between "news" and "article" on Setopati either, and I read it daily. What I can tell is "happened today, short, where" versus "sit down and read this". So news = short (a few paragraphs, no block editor), always has a place and a date, and it is stale in a week. An article is the long thing. If that is the whole difference, it is a `kind` on the same item, not a new type, and the Desk shows one queue with a badge. Do not give me a third tab. I will not click it. And please: if "news" means the reporter typed it in two minutes, how is it "verified"? What does the moderator actually check on a news item? If the answer is "nothing, we just approve", say so on the page.

**AI writer.** As an editor at a regional portal: that is my reporting, paraphrased, under your brand, with your "verified" tick on it. I would notice within a day and I would be angry, and I would say so on Facebook, which is where your readers are. As a reader: if it is Onlinekhabar's story, I will just read Onlinekhabar. Why would I read your rewrite? The only version I would trust is the one that looks like a round-up: "Three portals reported X. Here are the links. Our correspondent in Ward 4 adds: ..." The AI can draft the "three portals reported" line. It must not write facts the reporter did not see. Everything else, skip for now.

## The Executor (Response C)
**Monday morning, in order:**

**1. Language display: ship nothing new.** Each DISPATCH already carries `language: "en"|"ne"`. The feed renders each card in its stored language, full stop. The global EN/NE toggle keeps controlling chrome (nav, buttons, labels) only. Add one thing: a `Preferred language first` sort tiebreak and a small `ने`/`EN` chip on each card. Half a day. No translation, no dual-field authoring, no per-item language toggle.

**2. News = a `kind` field on DISPATCH, not a new item type.** `kind: "article" | "news" | "story"`. Same PK/SK, same locality GSI, same status machine, same Desk queue. Difference is a validator and a renderer, not a table:
- News: title required, body ≤ ~1200 chars plain text (no block editor), one optional image, `sourceUrls[]` optional, one tag, locality required, `expiresAt` = +7 days (feed hides it; permalink still works).
- Article: unchanged.
- Desk: one queue, filter chip for kind. Add a "quick approve" for news (title+body+source visible in the row, approve inline). That's what keeps moderation from tripling: news is small enough to approve from the list.

Migration: backfill `kind: "article"` on existing rows with the existing `backfill` runner pattern. Two slices: (a) kind + validators + feed render, (b) Desk inline approve.

**3. AI writer: build the boring half, defer the merge.** Slice 1 is "paste a link, get a draft form prefilled" — a Lambda that fetches the URL, extracts og:title/description/main text with a readability parser, and returns it into the news form with `sourceUrls` locked and shown publicly as "Sources:". No LLM, no merge, no cost line, no copyright exposure beyond quoting a headline. That's a week.

Slice 2, only if reporters actually use slice 1: one server-side LLM call (`summariseSources(sources[]) -> {title, body, claims[]}`), each claim tagged with which source it came from, prompt forbids facts not present in inputs, output ≤ 1200 chars, model = cheapest tier, rate limit 10/day/reporter, moderator sees the sources beside the draft. Still goes through the Desk. Never "merge 1..N portals into one story" as the headline feature — that's the takedown-and-hallucination path. Label it "AI-drafted from sources" on the page.

Don't build: separate NEWS table, reporter-publishes-without-Desk, multi-source merging on day one, translation.

# PEER REVIEWS (A=Outsider, B=First Principles, C=Executor, D=Contrarian, E=Expansionist)

## Review by contrarian lens
**1. Strongest: D.** It is the only one that names the contradiction nobody else resolves: "fast news" and "moderator-approved" cannot both hold, so `kind: news` either destroys "verified" or is just a short article. It also flags that district-scoped moderators are not language-scoped, and that a 30-second LLM fetch inside a 10-concurrency Lambda blocks the Desk. Concrete failure modes, not product vision.

**2. Biggest blind spot: E.** It treats a 48-hour auto-expiring, correspondent-auto-published news stream as a "human-verified incident log" BIPAD would pay for. Auto-publish with post-hoc review is by definition unverified at the moment it matters. Its "conflict detector" still ingests full third-party text, so the copyright exposure D describes is unchanged; attribution does not cure derivative works. And diaspora translation volunteers are a cold-start supply problem on top of the one round 1 already found.

**3. All five missed:**
- The owner said "news and articles are different" twice and no one asked whether the owner will accept `kind` on DISPATCH. B/C/D/E all decide the schema for him; a round-2 verdict that ignores the stated requirement risks being overruled in round 3.
- URL fetching from Lambda is a request-forgery and paywall/robots.txt problem, and Nepali portals are often JS-rendered or block bots. The "boring half" (C) may not work at all.
- Liability sits with the named correspondent, not the site. No one addressed consent or defamation exposure for a volunteer whose byline carries LLM-merged claims about real people.

## Review by firstprinciples lens
**1. Strongest: B.** It reduces all three questions to one axiom (trust layer over a disaster, not a newsroom) and derives each answer from it: toggle governs chrome because the post is the unit of trust; news is `kind` + `happenedAt` + `sources[]` because time-to-truth is the only real difference; the AI merger is negative-value *even if perfect* because nobody in the chain witnessed anything. Its inversion (LLM tidies the correspondent's own notes) solves the actual bottleneck. C is the best implementation plan; pair them.

**2. Biggest blind spot: E.** It claims a cross-portal conflict detector "proves" the verified brand. It proves the opposite: a diff between Onlinekhabar and Kantipur is still zero first-hand observation, now with a tick on it. "Trusted correspondents auto-publish" quietly deletes the moderation step the brand rests on, and diaspora ads/BIPAD buyers are revenue fantasies for a site with no audience yet.

**3. All five missed:** STORY already exists as the short, timely, locality-ready type. Nobody asked whether "news" is just STORY with text instead of media, so the council is designing a third kind when the codebase may have two already. And nobody asked the owner for one concrete example of a news item they expect; the AI request is a supply-side symptom (no original reporting to publish), not a feature need.

## Review by expansionist lens
**1. Strongest: E.** It is the only one that turns each decision into an asset rather than a cost. News-with-decay becomes a ward-level timestamped incident dataset (BIPAD/DDMC/INGO integration), mixed-language feeds become a diaspora audience and translation-task pipeline, and the AI writer inverted into a cited conflict detector ("Onlinekhabar says 3, Kantipur says 5") turns attribution into the proof of "verified". C is the best execution plan, but E names the upside that justifies doing any of it.

**2. Biggest blind spot: D.** It frames every item as pure risk and ends at "build nothing that writes prose". It misses that the source-diff E describes is precisely the moat D says it wants to protect, and that a sources field without extraction is a dead end. It also never asks what correspondents would do instead, which B at least does (notes/voice memo to draft).

**3. All five missed:**
- The round-1 cold-start problem: a paste-link-get-cited-brief tool is the supply engine for 753 empty localities. Nobody tied the AI writer to the empty-feed fix.
- Partnership instead of extraction: regional portals as syndication partners (link-back, traffic, canonical tags) converts the copyright threat into distribution and inbound SEO.
- Diaspora readers as translators and payers (E hints, nobody develops).
- Voice input: correspondents on Android dictate; a Nepali speech-to-draft path beats a URL merger for original, verifiable reporting.

## Review by outsider lens
**1. Strongest: C.** It is the only one a volunteer can act on Monday: `kind` on DISPATCH, concrete field limits, a 7-day `expiresAt`, inline "quick approve" as the actual answer to "don't triple moderation", a backfill note, and an AI slice 1 (readability fetch, no LLM) that is cheap and legally quiet. D's critique is sharper, but C turns the same conclusions into slices.

**2. Biggest blind spot: E.** It treats reporter-pasted links as a "conflict detector that proves verified." Showing "Onlinekhabar says 3, Kantipur says 5" verifies nothing; it republishes two unverified numbers with a tick next to them, and the diaspora/BIPAD/drone pipeline is three products away from a team with no server-side LLM. It also skips copyright entirely.

**3. All five missed:**
- The reader's eye: A/B/C/D all say "news is short and dated", but no one asked what the *card* says. "Verified" on a two-minute post from a correspondent nobody knows means nothing without a visible "who saw this, when" line. Byline + locality + "reviewed by moderator X" is the trust unit, not `kind`.
- Nobody addressed what happens when a news item is wrong: corrections, retractions, and whether the 7-day expiry quietly buries errors about real people.
- Legal: nobody checked whether locality-stamped "news" shifts VerifiedNepal from platform to publisher under the DIB registration already flagged in round 1.

## Review by executor lens
**1. Strongest: C.** It is the only one that reads as a Monday-morning plan: ordered slices, sizes (half a day, a week), the backfill runner that already exists, validator-not-table, and the Desk inline-approve as the concrete answer to "don't triple moderation". Its AI slice 1 (fetch URL, prefill form with readability extract, locked `sourceUrls`, no LLM) is buildable this week with zero cost line and zero copyright exposure, and it gates slice 2 on actual usage. B and D reach the same conclusions but stop at principles.

**2. Biggest blind spot: E.** Translation-as-volunteer-task, diaspora ad buyers, BIPAD-sellable incident datasets, drone/SMS merge pipelines: none of it is executable by one owner delegating slices to Codex on a 10-concurrency Lambda. "Trusted correspondents auto-publish" quietly deletes the only thing round 1 said the product has. It also hand-waves "cost is trivial" with no number.

**3. All five missed:** nobody asked what the owner actually gets on Monday. Specifically: (a) a 30-second fetch inside a 10-concurrency Lambda is a Desk outage; even C's no-LLM fetcher needs a timeout, size cap and SSRF allowlist of Nepali portal domains; (b) who the first ten news items come from, since `kind: news` with no reporters is an empty strip; (c) nobody sequenced the three decisions. Order is: language chip (hours), kind field (days), fetcher (week), LLM (never until measured).
