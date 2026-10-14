# Council transcript round 3: post-moderation of local updates (2026-10-14)

# The question (round 3)
## Context: round 3 of a council on VerifiedNepal's "local updates" feature
VerifiedNepal (verifiednepal.com) is a volunteer-run, bilingual (English/Nepali), mobile-first disaster-response and mutual-aid platform for Nepal. Brand: "verified, not viral". Everything public today (help requests, offers, projects, articles, stories) goes through PRE-moderation: it sits pending until a district-scoped volunteer moderator approves it on "The Desk". Every moderator action is written to a public, masked audit log. The public can flag any published item as fake (a FLAGGED queue exists on the Desk).

Rounds 1 and 2 are settled. The owner has now DECIDED the following (not up for debate this round):
- News is `kind: "news"` on the existing article item (DISPATCH), reusing fields; it gets its OWN tab in the public UI and its OWN queue on the Desk.
- News is short, plain text, with a required locality that is PRE-FILLED from the reporter's home locality, and a scope chosen by radio buttons: Ward -> Municipality -> District -> Province -> Nepal.
- **News is POST-moderated, not pre-moderated.** It is publicly visible immediately on publish, and gets reviewed by a moderator afterwards. The owner wants "an unmoderated news list" of some kind so unreviewed items are distinguishable, but has left the design to the council.
- Reporter = `reporter` role on USER with home localities (empty = national); anyone signed in can apply; admin approves; multiple reporters per locality; reporters may post outside their locality.
- Language: each post shows in the language it was written in; moderators will declare, at onboarding, which language(s) they moderate.
- No public points (private tally + public profile). Ads: two labelled slots, admin-managed. Condolences and the AI writer are deferred.
- Public naming: "local updates", not "news portal".
- Rollout: ALL 753 local levels from day one, not a pilot.

## The question for this round
Design the post-moderation system for news so that the "verified" brand survives it. Specifically:

1. **Who moderates a news item after it's published?** The owner's worry: a reporter can post something fake, and a moderator from the same locality might be a friend and approve it. Should review be CROSS-locality (a moderator from a different district/municipality must review), same-locality (local knowledge is needed to judge local claims), or something else (two reviewers, random assignment, trust tiers, national moderators for high-scope items)? Moderators today are district-scoped via a `districts` array, and the pool is small and volunteer.
2. **How is unreviewed news displayed?** A separate "unreviewed" list, or inline in the news tab with an "Unreviewed" badge and a reviewed mark once a moderator passes it, or hidden from the home page until reviewed, or something else. How do readers tell reviewed from unreviewed at a glance in both languages? Does unreviewed news appear in share cards, SEO sitemap, the home "Your area" block?
3. **What happens on rejection after publication?** Takedown, replace with a "removed" notice, correction note, strike against the reporter, reporter suspension thresholds, repeat-offender handling, appeal.
4. **Abuse controls** without pre-moderation: rate limits per reporter, scope limits (should a new reporter be able to publish "Nepal"-scope news on day one?), trust tiers (first N posts pre-moderated, then post-moderation), public flag threshold that auto-hides, cool-down.
5. **Does the reporter role as decided still work** with post-moderation at national scale (753 local levels, unknown number of reporters), and what minimum changes would make it safe?

## Technical facts
Node 22 Lambda + single-table DynamoDB; status machine draft/pending/published/rejected on DISPATCH; GSI2 keyed by status (`DISPATCH#pending`); public FLAGGED queue; public audit log; district-scoped `isOutOfScope()` helper for moderators; reach counters per page; OG share cards per article; sitemap generated from published items. Lambda concurrency cap 10 (increase pending). Small volunteer dev capacity, slices delegated to Codex/Claude.

## What's at stake
Post-moderation is the first time VerifiedNepal will show the public something no moderator has checked. If the design is wrong, a fake death toll or a defamatory post sits live under the site's name during a disaster. If the design is too heavy, reporters stop posting and the news tab is empty across 753 localities.

# ADVISOR RESPONSES

## The Contrarian (Response E)
The fatal flaw is in the premise: "post-moderation at 753 local levels from day one" with a small, district-scoped volunteer pool is not a moderation system, it's a backlog with a brand attached. Here is where it breaks.

**1. Who moderates.** Cross-locality review is the only option that defuses the friend-approves-friend worry, but it destroys the one thing that makes a reviewer useful: they can't judge "the Marsyangdi bridge is down" from Jhapa. Same-locality review has the collusion problem AND the coverage problem: most of 753 localities will have zero moderators. So any single-reviewer scheme fails. The honest answer: scope decides the reviewer. Ward/Municipality items get the district moderator (local knowledge, accept the collusion risk because blast radius is small). District and above get a second reviewer from outside the district, mandatory. Province/Nepal scope gets a national moderator, full stop. Don't invent "random assignment" or "trust tiers" for a pool you can't yet count.

**2. Display.** Inline with a badge is a trap. "Unreviewed" in grey next to the VerifiedNepal wordmark reads as "VerifiedNepal says" to anyone sharing a screenshot. Unreviewed items: own list, excluded from home "Your area", from OG cards, from the sitemap. Share link works but the OG card says "Unverified report" in both languages. Badges are not a brand defence; placement is.

**3. Rejection.** Replace, don't delete: the URL stays, body replaced with "Removed by moderator: [reason]" in both languages, audit log entry as now. Deletion invites "they're hiding it" screenshots. Three rejections in 90 days = reporter role revoked, admin re-approval needed. Appeal is a comment on the audit entry. No more.

**4. Abuse controls.** The one that matters: new reporters cannot publish above Municipality scope until N (say 10) items pass review. Everything else (rate limits, flag thresholds) is secondary. A fake national death toll is the failure mode; scope-gating is the cheapest fix. Public flag auto-hide at a fixed count is gameable by brigades; skip it, route flags to the queue instead.

**5. Does the role work?** No, not as decided. "Reporters may post outside their locality" plus post-moderation plus unknown pool size means anyone approved anywhere can post anything about anywhere, live, immediately. Minimum change: scope-gating per reporter, and national-scope items require a national moderator before leaving the unreviewed list. Without that, "verified, not viral" is a lie on day one.

## The First Principles Thinker (Response D)
The question isn't "who checks it after" — it's "what does the site vouch for?" Pre-moderation made publication itself the vouch. Post-moderation breaks that unless you move the vouch from the act of publishing to a visible mark. So: the brand is the badge, not the feed. Design everything around that.

**1. Who reviews.** Don't solve friendship with geography; solve it with transparency and cost. One reviewer suffices if the review is logged publicly (you already have this) and the reviewer is named in the masked log as "not the author's locality" or "same locality". Rule: any moderator may review, but same-municipality review is permitted only for Ward/Municipality scope; District+ scope requires a reviewer whose `districts` array excludes the author's home district. Two reviewers is a luxury a volunteer pool can't afford at 753 localities; cross-district for high-scope items is cheap and hits the actual risk (fake death toll travels at District/Nepal scope, not Ward).

**2. Display.** Inline, one tab, two states: a grey "Unreviewed / असत्यापित" chip, replaced by the existing verified mark. No separate list — a separate list is a second feed nobody reads and moderators forget. Unreviewed items: excluded from home "Your area", sitemap, and OG cards (share card renders a plain "unreviewed update" card without the claim text). Sharing is the amplifier; starve it until review.

**3. Rejection.** Replace body with "Removed by moderator: <reason category>", keep URL, link audit entry. Strike = one rejected post. Three strikes in 90 days → reporter falls to pre-moderation (status `pending`, existing path). Appeal = flag your own rejection; goes to a different-district moderator.

**4. Abuse.** Scope follows trust: new reporter gets Ward+Municipality only; District after 5 reviewed-pass posts; Province/Nepal admin-granted. Rate: 5/day. First 3 posts pre-moderated (reuse `pending`). Public flags ≥3 distinct accounts → auto-flip to unreviewed-hidden and front of queue.

**5. Role.** It works, with one change: the role needs a `tier` field. Everything above is `tier` + existing status machine. No new tables.

## The Expansionist (Response A)
Everyone is designing a cage. Design a flywheel instead.

**1. Who moderates.** Both. Same-locality for *fact*, cross-district for *conduct*. But the bigger upside: make the first reviewer *another reporter*. 753 localities with multiple reporters each is a reviewer pool an order of magnitude larger than the volunteer moderator pool. Two peer confirmations from different home localities ("I have seen this too") flips the item to "Confirmed by 2 local reporters"; a moderator from outside the district does the formal pass later. That turns reporters into a mutual-verification network, which is the asset no Nepali news outlet has. Scope >= Province routes to a national queue automatically.

**2. Display.** Inline, never a ghetto list. The badge is the product: "अपुष्ट / Unconfirmed" -> "पुष्टि गरिएको / Verified". Watching a post *earn* its tick in real time is the brand made visible. Unreviewed items: in the news tab and "Your area", yes; share cards carry the Unconfirmed watermark baked into the PNG (that watermark travels onto WhatsApp, the real distribution channel, and advertises the brand); sitemap only after review.

**3. Rejection.** Never silent takedown. Replace with a stub: "Removed by moderator: unverifiable death toll" plus the masked audit entry already built. The correction trail is a public dataset of rumour debunking. Repeat-offender handling is just the private tally going negative; three rejections in 30 days drops the reporter to pre-moderation.

**4. Abuse.** Trust tiers, computed, not configured: first 5 posts pre-moderated and scope capped at Municipality; 5 clean reviewed posts unlocks post-moderation and District; 20 unlocks Province/Nepal. Rate limit 10/day. Three public flags from distinct accounts auto-collapses to "Under review" (not hidden). This is one `trust` integer on USER and one `isAllowedScope()` helper.

**5. Does the role work?** Yes, and it's bigger than news. A graduated reporter corps across 753 localities is a nationwide verified ground-truth sensor network. Next: reporters attach location-tagged photos, which seeds the flood-impact layer, BIPAD feeds, and the org 3W coverage you already built. The news tab is the recruiting funnel for the sensor network.

Minimum changes to ship: the tier integer, the scope helper, the stub-on-reject, the badge. Everything else is already in the codebase.

## The Outsider (Response C)
I am a reader in Chitwan on a 2 GB Android, data costs money, and I open your site because someone forwarded a link on Facebook about a landslide. Here is what I actually see and ask.

**1. Who moderates?** I don't know what "district-scoped" means. What I notice is: the post says "Published by Ramesh, reporter, Ward 4" and nothing else. Does a friend approve it? I can't tell, and I won't check your audit log, I don't know it exists. Simple answer that even I understand: one reviewer must be from OUTSIDE the reporter's district; for Province/Nepal scope, two. Local knowledge is not needed to spot "47 dead" with no source, and the cross-district person at least can't be the reporter's cousin. Random assignment inside that rule. Don't build trust tiers yet; you don't have the moderator headcount to make tiers mean anything.

**2. Display.** Inline, one list, with a big label on every card. Not a tiny grey badge. Say the words: "Not yet checked" / "अझै जाँच भएको छैन" and after review "Checked by volunteer" / "स्वयंसेवकले जाँचेको". Icons alone fail on my screen. Unchecked items: NOT in share cards, NOT in the sitemap, NOT in "Your area" on the home page. If I can only get to it by opening the Local Updates tab, the viral spread problem is mostly gone. Share button on an unchecked post should say "You are sharing something not yet checked." Honestly, as a naive moderator I'd ask: why can a post reach Facebook before anyone looks at it?

**3. Rejection.** Never silently vanish; I'll think you're hiding things. Replace with "Removed: could not be confirmed" and keep the URL. Strike counted. Two strikes in 30 days, posting pauses for a week; three, role removed, admin must restore. Appeal is just a form that goes to an admin. Reporters are humans, mistakes happen; fakes get a fast exit.

**4. Abuse.** New reporter: Ward and Municipality only for first 10 checked posts. Five posts/day. Three public flags auto-hides pending review. No pre-moderation tier beyond that; it's complexity for an empty tab.

**5. Does the role work?** Barely. 753 localities, unknown reporters, and admin-approved applications: the bottleneck is approving reporters, not posts. Minimum: scope ladder above, cross-district review, and admin can approve a reporter from their phone in two taps. Otherwise the tab is either empty or unsupervised, and I can't tell which from Chitwan.

## The Executor (Response B)
Monday morning, in the order you ship it:

**1. Who reviews.** Don't build cross-locality assignment or two-reviewer flows. Reuse the existing queue: `DISPATCH#pending` with `kind:"news"` is the Desk News tab. Any moderator can act on it; `isOutOfScope()` becomes a *sort key*, not a gate, with local items floated to the top. The friend-approves-friend worry is solved by the thing you already have: the public audit log records `reviewed_by`. Add one rule in code, not process: reporter ≠ reviewer, and if `reviewer.districts ∩ reporter.homeLocalities` is non-empty the approve action still works but writes `local_review: true` into the audit entry. Scope ≥ Province additionally requires `moderator.national === true` (one boolean on USER). Skip random assignment and trust tiers for moderators, add when the pool exceeds ~50.

**2. Display.** One status value: `published` with `reviewed_at` null or set. Inline in the news tab, badge "Unreviewed / असत्यापित" when null, small check "Reviewed / सत्यापित" when set. No separate list; the Desk queue *is* the unreviewed list. Unreviewed items: excluded from home "Your area", sitemap, and OG cards get a `noindex` + the badge burned onto the card. Appear only on the news tab and direct URL.

**3. Rejection.** Status → `rejected`, page renders a one-line "Removed by moderator" notice (keeps the URL honest, kills the share). `strikes` counter on USER increments; three strikes in 30 days flips `reporter.suspended_until` for 14 days; second suspension revokes the role. Appeal = existing contact form, admin resets. Correction note = a moderator-only `note` string shown above the item.

**4. Abuse.** Rate limit: 5 posts/24h per reporter, checked by querying their last five items. Scope limit: `posts_reviewed_ok < 3` forces Ward/Municipality only, and those first 3 land as `pending` (pre-moderated). Public flags: two flags from distinct signed-in users auto-sets `reviewed_at=null, hidden:true` and bumps the item to queue top. No cool-down needed, rate limit covers it.

**5. Reporter role.** Works. Minimum: the first-3-pre-moderated gate, scope ladder, national flag on moderators, auto-hide on flag. Everything else is a counter on USER you already have the pattern for.

Skipped: assignment engine, reviewer pairing, trust tiers. Add when the audit log shows actual local-collusion, not before.

# PEER REVIEWS (A=Expansionist, B=Executor, C=Outsider, D=First Principles, E=Contrarian)

## Review by contrarian lens
**1. Strongest: B.** It is the only one that ships against the real constraint (small pool, concurrency cap 10) by reusing `DISPATCH#pending` as the unreviewed list and turning `isOutOfScope()` into a sort key. It accepts collusion risk honestly and makes it auditable (`local_review: true`) instead of pretending geography fixes friendship. Weakness: its two-flag auto-hide is brigadable; E is right to route flags to the queue instead.

**2. Biggest blind spot: A.** "Confirmed by 2 local reporters" is a collusion amplifier, not a check. Reporters may post outside their locality, so two friends with different home localities can mint a verified-looking badge with zero moderator involvement, and that badge is a stronger false vouch than "unreviewed". A also pushes unreviewed items into "Your area" and share cards, the exact amplifiers the brand cannot afford. The "sensor network" pitch is scope creep dressed as vision.

**3. All five missed the time axis.** None defines what happens to an item nobody ever reviews. At 753 localities with a volunteer pool, "Unreviewed" becomes the permanent default state and the badge stops meaning anything; set a staleness rule (auto-archive or demote after N hours). Also missed: a reporter editing an already-reviewed post must clear `reviewed_at`, and language-routing (Nepali post, English-only moderator) was never addressed.

## Review by firstprinciples lens
**1. Strongest: D.** It names the actual object being protected: not the feed, the vouch. Pre-moderation made publishing the vouch; post-moderation must move it onto a visible mark, and everything else (scope-gated reviewer rules, starving share/sitemap/home until review, one `tier` field) follows from that. Smallest design that answers the real question. B is the most shippable but treats collusion as a log annotation only.

**2. Biggest blind spot: A.** It proposes unreviewed items earn a "Verified" tick from two *other reporters*, the very population that has not been vetted, and bakes an "Unconfirmed" watermark into share cards so unreviewed claims travel to WhatsApp under the wordmark. That is the exact failure the round is meant to prevent, rebranded as a flywheel. The sensor-network vision answers a question nobody asked.

**3. What all five missed:** the semantics and lifetime of the mark. Nobody says what "reviewed" asserts. A Desk moderator cannot confirm a bridge is down; the tick means "not obviously fake/abusive," not "true." C's "Checked by volunteer" is honest; A's "Verified" overclaims. And no one addresses time: an item unreviewed after 48 hours in a district with zero moderators is indistinguishable from one posted a minute ago. "Unreviewed" must expire into "no moderator reached this" or auto-hide; otherwise the badge hides the backlog E warns about.

## Review by expansionist lens
**1. Strongest: A.** It is the only response that treats post-moderation as an asset rather than a liability. Peer confirmation by reporters multiplies review capacity 10x without a bigger moderator pool (the scarce resource every other response rations), the Unconfirmed watermark baked into the share PNG turns WhatsApp into brand distribution, the rejection stubs become a public debunking dataset, and the reporter corps feeds flood-impact and 3W layers already built. Computed trust tiers cost one integer. B is the best pure engineering answer but builds nothing new.

**2. Biggest blind spot: E.** It frames the whole thing as a backlog and proposes starving unreviewed items into a separate list, which guarantees the empty-tab failure the question warns about. It also dismisses flag auto-hide as brigadable without seeing that the flag count itself is a free community-verification signal. E defends the brand by hiding the product.

**3. All five missed:**
- Reporters as a two-way channel: moderators can ask "source?" or request a photo instead of binary approve/reject, which trains reporters and gives readers evidence.
- Reader "I saw this too" confirmations from signed-in locals (not just reporters), making locals the moderation pool.
- Reviewed local updates as structured data: locality + scope + timestamp is a crisis feed for orgs, BIPAD and media, the first real reason NGOs would pay attention to the platform.
- Positive incentives: a public "fastest verified" or reliability streak per locality to keep 753 tabs alive.

## Review by outsider lens
**1. Strongest: C.** It is the only response written from where the damage actually lands: a phone screen, a forwarded Facebook link, a reader who has never heard of an audit log. Its display rules are concrete words, not chips ("Not yet checked" / "अझै जाँच भएको छैन"), it refuses icon-only states, and it names the real bottleneck: approving reporters, not posts. The share-button warning is the single cheapest brand defence anyone proposed.

**2. Biggest blind spot: A.** "Watch a post earn its tick in real time" assumes readers refresh the page. They don't; they see one screenshot on WhatsApp, once. A also lets unreviewed items into "Your area" and relies on peer-reporter confirmations, which a reader cannot distinguish from a moderator check. Its sensor-network pitch answers a question nobody asked this round.

**3. All five missed:**
- The empty-state. On day one most of 753 localities will show nothing; what does the tab say so readers don't assume the site is dead or censoring?
- Low-bandwidth: a watermark "baked into the PNG" or a text badge still has to render on a 2 GB phone with images off. Status must be in plain text in the card itself.
- Time. Nobody says how long "Not yet checked" may stay so before the item is auto-hidden. During a disaster, hours matter more than reviewer geography.
- Moderator onboarding: a first-time volunteer needs a one-line rule ("reject if no source") per item, not a status machine.

## Review by executor lens
**1. Strongest: B.** It is the only one that ships Monday with the existing primitives: `DISPATCH#pending` is already the unreviewed list, `isOutOfScope()` becomes a sort key not a gate, `reviewed_at` null/set is the badge, `local_review: true` in the audit log answers the collusion worry without an assignment engine. Every control is a counter on USER. D is close (the `tier` field is the right single primitive) but adds cross-district gating that needs a reviewer-matching query you don't have.

**2. Biggest blind spot: A.** Peer confirmation by other reporters is a second workflow, a second role-check, and a second UI state ("Confirmed by 2") before a single moderator has touched anything. With unknown reporter density most localities will have one reporter, so the flywheel never spins; meanwhile you have built it. E is the counter-blind-spot: a separate list plus mandatory national moderator for Province/Nepal means with a pool of ~0 nationals, the tab is empty by design.

**3. All five missed:** the operational floor. Nobody said what happens when no moderator reviews within N hours. Post-moderation with no SLA is pre-moderation with a leak. Add one EventBridge rule (already in the infra): unreviewed > 24h at District+ scope auto-flips to hidden and pings admin. Also nobody costed the reach counter / Lambda cap: 753 live tabs under concurrency 10 is a 503 before it is a moderation problem.
