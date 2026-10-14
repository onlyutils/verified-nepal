# Council transcript: news portal, local correspondents, ads (2026-10-13)

# The question
## The decision
VerifiedNepal (verifiednepal.com) is a volunteer-run, bilingual (English/Nepali), mobile-first disaster-response and mutual-aid platform for Nepal. The owner wants to extend it into a NEWS PORTAL with locality-first delivery, a reporter programme, and paid advertising. The council must judge the product design: how reporters, localities, points, news display and ads should work, what to build first, and what to avoid.

## Owner's stated requirements (verbatim intent)
1. Admin can add a news reporter and specify the reporter's area. Reporters are LOCAL (e.g. Suryabinayak Municipality, Ward 4) or NATIONAL (covers anywhere). A local reporter reports news from their locality, and can add condolence messages for any death in their locality.
2. A signed-in user can APPLY to become a local reporter, stating their local level. Multiple reporters per local level are allowed; admin decides how many to approve.
3. Reporters earn POINTS based on how many news items they post and how much reach/views those items get.
4. Reporters must NOT be restricted from posting news/articles outside their locality. (Note the tension with #1: locality is the reporter's home beat, not a hard fence.)
5. USP for readers: they see THEIR locality's news first, then other news. Ask the user for location, or let them pick a preferred locality. Local news gets priority, maybe a separate section. The council must decide how news should be displayed.
6. The news display page must have advertisement slots.
7. Admin can add an ADVERTISEMENT MANAGER role who manages which ad goes where, who the ad targets, the display date range, and how much money the advertiser (tenant) pays. "Basically everything related to ads."

## What already exists in the codebase (reuse, don't rebuild)
- Backend: Node 22 on AWS Lambda, single-table DynamoDB with GSIs, route tables + withAuth wrappers. Roles today: helper | moderator | admin, stored on USER items; moderators are district-scoped via a `districts` array and an `isOutOfScope()` helper.
- Articles already exist: internally "DISPATCH" items with status draft/pending/published/rejected, a signed-in block editor, 1-3 tags from a fixed list, bilingual title/body, media uploads via OnlyUtils presign. Moderators approve articles on "The Desk" (/desk). Public list at /articles with tag filter and cursor pagination. Articles currently have NO district or municipality field.
- Stories (photo/video + caption) exist as a separate STORY type.
- A checked dataset of all of Nepal's 753 local levels (municipalities) with ward counts AND per-ward centroid lat/lng is bundled (server/src/data/admin-units.json). Needs already use municipality+ward pickers.
- First-party page-view counting exists: POST /reach, REACH#STATS counters per page and per day, Desk "Reach" tab (admin only). Per-item view counts exist for a few detail pages.
- A private monthly "work tally" (explicitly NOT a leaderboard/score) already exists for moderators and helpers.
- Public audit log of every moderator action. Public ledger. Strong "verified, not viral" brand: the site is about trust during disasters.
- Frontend: React + Vite + Tailwind + shadcn, Cloudflare Pages, SEO work ongoing (OG tags per article, sitemap, Pages Functions). Home page currently shows disaster stats, help board, stories strip, articles.
- Lambda concurrency is capped at 10 per account (increase requested, pending). Free-tier-ish budget; volunteer dev capacity; owner delegates coding to Codex/Claude in slices.
- No advertising code exists anywhere today. No payments integration exists.
- Nepal context: 7 provinces, 77 districts, 753 local levels, ~6,700 wards. Local news in Nepal is dominated by Facebook pages and a handful of regional portals; ward-level reporting is sparse. Most readers are on Android phones, often on slow data. Many readers write and read Nepali.

## What's at stake
If this goes well, VerifiedNepal becomes the place Nepalis check for what's happening in their own ward, funded by local ads, with a reporter network that also feeds disaster coverage. If it goes badly: the trust brand gets diluted by unverified or ad-driven content, a points system invites spam, the ad system becomes a bookkeeping burden for volunteers, and a lot of engineering goes into features nobody uses. The owner must choose a design and a first slice to build.

# ADVISOR RESPONSES

## The Contrarian (was Response C in review)
The fatal flaw is in requirement 3. Points for post count plus views, on a platform whose entire brand is "verified, not viral," is a machine for manufacturing the thing the brand exists to oppose. The first reporter who figures out that a photo of a crashed bus in a neighbouring district outperforms a ward-4 drainage notice will post crashed buses. Requirement 4 explicitly lets them. So locality-first delivery (the USP in #5) is immediately undercut by #3 and #4 together: you've built incentives for non-local clickbait and then told readers you specialise in local. The owner already recognised this tension once, with the work tally that is "explicitly NOT a score." Points are a score. Pick one.

Second: who verifies? Today moderators are district-scoped and every action is audit-logged. A reporter programme implies reporters are trusted to publish. If they still queue through the Desk, then "reporter" is just a user with a bio field and the whole role system is cosmetic. If they bypass the Desk, the trust brand is gone the first time someone posts a wrong death notice. Condolence messages for "any death in their locality" are the single riskiest content type on the platform: unverifiable, emotionally charged, legally exposed, and exactly what Facebook pages already do badly.

Third: ads with no payments integration and volunteer bookkeeping. An "advertisement manager" who records "how much money the advertiser pays" in a DynamoDB field is a ledger nobody reconciles. Where does the money actually move? Who issues invoices? Who is liable when the ad runs past its date? The ad spec is a CRM wearing a feature's clothes.

Fourth, what's missing: no district field on articles. Everything downstream (locality-first, reporter beats, ad targeting) depends on a column that does not exist. The real first slice is boring: add municipality/ward to DISPATCH, backfill, filter. Build nothing else until readers actually use that filter. If they don't, the reporter programme and ad system were solutions to a demand that was never measured.

## The First Principles Thinker (was Response E)
Strip the seven requirements away and ask what the owner actually wants: more Nepalis checking verifiednepal.com regularly, so that when a flood hits, the audience is already there. That is an audience-and-habit problem. "News portal with reporters, points and ads" is one hypothesised solution, and the hypothesis is wrong in three places.

First, "reporter" is not a new role. It is an author with a home municipality. Articles already exist with draft/pending/published and moderator approval; the only missing primitive is a `municipality` field on the DISPATCH item and the same field on the USER. That is the whole reporter programme. Applications, approvals, local-vs-national flags: all of that is the existing moderator scoping (`districts` array, `isOutOfScope()`) pointed at a municipality instead of a district. Requirement 4 even says the fence is soft, so it is literally just a default value on the picker.

Second, points are the opposite of the brand. The platform's entire asset is "verified, not viral." A reward for volume times views is a reward for being viral, and the owner already built a private work tally precisely because a leaderboard was rejected once. The honest first-principles answer is: do not build points. If reporters need recognition, show their byline, their municipality and their published count on a public profile. That costs nothing and cannot be gamed into spam.

Third, ads before readers is building the till before the shop. No ad manager role, no payments, no targeting. Put a static "sponsored by" slot on the local page that a volunteer edits in a config file, and fill it only once a locality actually has a weekly audience. The bookkeeping burden the brief fears is exactly what an "ad manager who handles everything" creates.

The real question is: can a municipality field plus a "your area" filter on /articles produce one ward that returns daily? Build that single slice, pick five pilot municipalities, and measure with the reach counters you already have. Everything else is premature.

## The Expansionist (was Response D)
The undervalued asset here is the ward-centroid dataset. 6,700 wards with lat/lng, already checked, already bundled. Nobody in Nepal has that wired to a content feed. Facebook pages can't do "your ward first" because Facebook doesn't know Nepali wards. That geographic index is the moat, and it's already sitting in the repo.

So think bigger than "news portal." Every DISPATCH, STORY, Need, and condolence tagged to municipality+ward becomes a single locality feed: what happened, who needs help, who died, who's selling. That's not a news site, that's the ward's Facebook replacement, with trust baked in. The USP writes itself: "the only place that knows your ward."

Second hidden upside: the reporter programme is a disaster-response sensor network in disguise. 753 local levels, two reporters each, and you have 1,500 verified people with cameras who already know how to post, pre-trained before the next flood. The flood-impact work already needs ground truth for satellite tiles. Reporters are that ground truth. Pitch the programme that way to NGOs and the infra memo's "One Door" funders.

Third: condolence messages are the growth engine, not a side feature. Deaths are the single most-shared ward-level content in Nepal. Every condolence post is a WhatsApp share, every share is a new reader who sets their locality. That onboarding loop costs zero marketing.

On ads: don't build a national ad network. Build "ward notices" that a local shop or municipality office pays for, flat rate, one slot per locality feed. Municipalities already spend budget on public notices in print. That's the paying tenant, and it's a public-information service that fits the brand.

Build first: locality field on DISPATCH + the ward-first feed. The dataset makes it almost free, and everything else compounds on top of it.

## The Outsider (was Response B)
Read this as someone who runs a pharmacy in Suryabinayak and checks Facebook for what's going on in my ward. Naive questions, in order of how much they'd stop me.

**"Reporter" means what, exactly?** On a site whose whole pitch is "verified, not viral," the word reporter makes me assume a journalist. Requirement 2 says anyone signed in can apply. So is this a neighbour with a phone, or a journalist? If it's a neighbour, call it that ("ward correspondent," "local contributor") and show me on every post who this person is and that they live here. If I can't tell the difference between an approved local and a random article, the trust brand is already gone.

**Points for views is the Facebook problem you're trying to escape.** A reporter paid in points for reach will post the bus crash photo, not the ward water-supply notice I actually need. You already built a private tally that is "explicitly not a score" for moderators. Why does the reporter get a public score? Who sees the points, and what do they buy? If the answer is "nothing," don't show them. If the answer is "money," say so plainly.

**Condolence messages for "any death in their locality"**: a stranger posting that my uncle died, before the family has told everyone, is a complaint waiting to happen. Who approves? Can the family remove it?

**Locality-first display**: I should never be asked for GPS. One picker, "Which municipality and ward?", remembered on my phone. Then one screen: "Ward 4" at the top, "Suryabinayak" below, "Nepal" below that. Three headings, not a separate section I have to find.

**Ads**: show me the ad is an ad. Label it, in Nepali too. If a pharmacy ad sits beside a death notice from the same ward, the whole thing looks like it's selling grief. The ad manager role also makes me ask: who gets the money, and does the reporter? Readers will ask that too.

Build first: the ward picker and the three-heading display. Nothing else is visible to me.

## The Executor (was Response A)
Monday morning, the first slice is a schema change plus one picker, not a news portal.

**Data model (reuse DISPATCH):** add `municipality` + `ward` to DISPATCH items, same picker Needs already uses from admin-units.json. Add a GSI `LOC#<municipalityId>` sorted by publishedAt. That is the whole "locality-first" backend. Do not create a NEWS type; an article with a locality is a local news item.

**Reporter = role on USER, like moderator.** Add `reporter` to helper|moderator|admin, with a `localities: [{municipality, ward}]` array mirroring the moderator `districts` array. National reporter = empty array. Application = a request item (`REPORTER_REQUEST`, status pending/approved/rejected) approved on The Desk, same flow as moderator approval. Reporter articles still go through pending → published; the only change is the article pre-fills the reporter's home locality and renders a "reported from Ward 4" chip.

**Reader locality:** one `localStorage` key, set via the existing picker, no geolocation yet. /articles queries the LOC GSI first, then the existing all-articles list. Home gets a "Your ward" section above the articles strip when the key is set. No account required.

**Points:** do not build a points system. Extend the private monthly work tally with articles published and reach per article, visible to the reporter only. If the owner later wants public points, it is a one-line query on top of that.

**Ads:** slice 3, and it is manual. An `AD` item: image, link, target municipality or `all`, start/end date, note field for what was paid. Admin role only; skip the ad-manager role until there is a second person doing it. Slots: one at the top of /articles and one in the article body. Nothing else. No payments integration.

**Sequence:** week 1 locality on articles + reader picker; week 2 reporter role + apply flow; week 3 ads item + two slots. Condolences are an article tag, not a feature.

# PEER REVIEWS (letters: A=Executor, B=Outsider, C=Contrarian, D=Expansionist, E=First Principles)

## Review by contrarian lens
1. **Strongest: A.** Only one that lands on a diff: `municipality`+`ward` on DISPATCH, a LOC GSI, reporter as a role mirroring the `districts` array, localStorage picker, tally instead of points, manual AD item. Sequenced, reuses everything. Weaknesses: localStorage-only locality means every cold visit and every crawler sees the national feed, so the "USP" is invisible to SEO and first-time Facebook arrivals; and "condolences are a tag" waves away the one content type B and C correctly flag as the lawsuit.

2. **Biggest blind spot: D.** It makes grief the growth loop and municipal budgets the ad tenant on a trust brand. Government paying for slots is editorial capture on day one. "1,500 verified people with cameras" lands on a Desk staffed by volunteer moderators and a Lambda cap of 10. D never says the word "moderation."

3. **All five missed moderation throughput and the bilingual cost.** Everyone keeps pending → published through The Desk, nobody did the arithmetic: 753 localities producing even two items a week is ~1,500 approvals a week for a district-scoped volunteer pool. The reporter programme multiplies reviewer load, not readers. Also, articles are bilingual title/body today; ward reporters will write Nepali only. Either drop the English requirement for local items or expect near-zero throughput. Nobody addressed either.

## Review by firstprinciples lens
**1. Strongest: E.** It is the only one that names the actual problem (habit and audience before the next flood), reduces "reporter" to an author with a home municipality on existing primitives, and ends with a falsifiable test (five pilot municipalities, reach counters already built). A is the best executable plan and should be the implementation of E's slice; A and E agree on the first week.

**2. Biggest blind spot: D.** It assumes tagging content by ward creates demand, then scales scope to "ward Facebook replacement" and a 1,500-person sensor network for a volunteer team capped at 10 Lambda concurrency. It treats condolence posts as a growth loop while B and C correctly flag them as the highest-harm, least-verifiable content type. Moat is not the dataset; it is trust, which D would spend.

**3. What all five missed.** Everyone rejected points without replacing the incentive. Points were the owner's answer to the supply problem: why would anyone write Ward 4 drainage notices for free, repeatedly? No response asked what motivates a ward correspondent (status, print byline, municipality recognition, small stipend from ad revenue). Also unaddressed: Nepal requires online news portals to register with the Department of Information and Broadcasting; calling this "news" with "reporters" may trigger obligations a mutual-aid site currently avoids.

## Review by expansionist lens
**1. Strongest: D.** It is the only response that treats the ward-centroid dataset as a moat and asks what else it unlocks: a unified locality feed across DISPATCH, STORY and Needs (not just articles), reporters as a pre-trained disaster sensor network fundable via the "One Door" NGO memo, condolences as a WhatsApp-share onboarding loop, and municipal public notices as the paying tenant (a real, budgeted line item in Nepal). Same first slice as A/C/E, but with a reason to keep going.

**2. Biggest blind spot: C.** It spends four paragraphs on what will go wrong and ends at "build the filter, then wait for demand." No articles carry a locality today, so a filter over an empty column measures nothing. It never asks who supplies the first local content, or what the reporter network is worth beyond news. Pure risk, no upside, no experiment design.

**3. All five missed:**
- **Distribution.** Readers are on Facebook and WhatsApp; nobody proposed auto-posting locality items to a per-municipality Facebook page or a WhatsApp share card. The existing OG-card work makes this cheap, and it is how a ward actually hears about the site.
- **Municipalities as reporters, not just advertisers.** 753 local-government offices publish notices and already have ward secretaries; an official "ward office" account is verified content and a free content supply.
- **The condolence record itself** could become a structured deaths dataset (ward-level, dated), valuable for disaster casualty tracking.
- **Nepali-language SEO** on "<municipality> समाचार" queries, where regional portals are weak.

## Review by outsider lens
**1. Strongest: B.** It is the only response written from where I sit — the reader. It asks the questions I would ask before trusting the site: is a "reporter" a journalist or my neighbour, who sees the points, who approves a death notice about my uncle, and does a pharmacy ad next to a condolence look like selling grief. A is the best build plan and should be paired with B's labels and three-heading screen.

**2. Biggest blind spot: D.** It calls condolence posts a "growth engine" and a "WhatsApp share loop". To a family in Ward 4 that reads as monetising deaths, which kills the trust brand faster than any points system. It also assumes I will leave Facebook for a "moat" I never see; I care whether the page is useful, not whether the dataset is unique.

**3. All five missed:**
- The empty-feed problem. A ward of a few thousand people may produce one item a month. "Ward 4" heading with nothing under it tells me the site is dead. Fall back to municipality/district automatically, and start with districts, not wards.
- Many readers do not know their ward number or new municipality name after the 2017 restructuring. The picker needs the old VDC/village name, in Nepali script.
- Advertisers pay in cash, eSewa or Khalti, not a DynamoDB note.

## Review by executor lens
**1. Strongest: A.** It is the only response that is executable Monday morning. Concrete schema change (`municipality`+`ward` on DISPATCH, one `LOC#` GSI), reporter as a role on USER mirroring the existing `districts` array, reader locality as one `localStorage` key, points folded into the existing private tally, ads as a manual `AD` item with two slots, three-week sequence. E reaches the same conclusions but stops at "build that single slice" without the shape of the slice. C and B are critiques, not plans.

**2. Biggest blind spot: D.** It proposes a unified feed of DISPATCH + STORY + Needs + condolences + paid ward notices across 6,700 wards, and sells reporters as a 1,500-person sensor network. Nothing in it is a Monday task. It ignores the Lambda concurrency cap of 10, volunteer dev capacity, and the empty-feed problem: a ward-first feed with zero reporters shows a blank page. The moat is only a moat once there is content in it.

**3. All five missed: the cold-start and Nepali-text problem.** No response says how week 1 gets even one article tagged to a locality, or how existing articles get backfilled (C mentions backfill, nobody defines it: admin tags manually? default to national?). Nobody addresses whether the municipality picker, "Your ward" heading, and ad label ship in Nepali on day one. Both are cheaper than any feature discussed and both gate whether readers notice the slice at all.
