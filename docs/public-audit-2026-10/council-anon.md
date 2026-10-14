# Anonymised advisor responses

## Response A
**The ideal portal, from the Monday-morning seat.** It is a thing that publishes something today. Every ideal feature in the research (BS masthead, relative times, "ताजा" list, Viber share, RSS, provenance line per item, DoIB number in footer, labelled ad slots, zero clutter) is cheap. The one expensive thing is content that exists. The audience discovers on Facebook and verifies on radio; a portal wins the verification role only if a shared link opens to a page that has a dated, sourced item on it. Everything else is decoration on an empty room.

**Where Verified Nepal already matches:** mandatory source lines on every media block (`src/articles/render.tsx`), Article JSON-LD and real 404s (`functions/articles/[id].ts`), public `/ledger` and `/audit`, "never handles money", 44 px touch targets, bilingual string parity, no third-party analytics, no ads. That is a better trust skeleton than Onlinekhabar has.

**Where it does not:** `GET /dispatches` on prod returns `{"items":[]}`. Same for stories, incidents, projects, centres. The home page (`src/pages/home.tsx:365-407`) hides the stories strip when empty and shows zero article headlines ever. The site has 13 reading routes and nothing to read. Also: Gregorian-only `formatDateTime` (`src/lib/format-date.ts`, 42 lines), no RSS (`/feed.xml` returns the SPA shell), no Viber in a WhatsApp/Facebook share row (`dispatch-detail.tsx:242-268`), no "latest" block on `/`, 0.5-0.9 MB of fonts, GOVERNANCE unlinked, five meanings of "Verified".

**Order of work, with days:**

1. **Publish content (0 code, 3 days of owner time).** Write five articles yourself from NDRRMA bulletins and the Trishuli imagery you already host. Approve them. Nothing below matters until this is true.
2. **Latest-articles block on home (0.5 day).** Copy the `Stories` component pattern in `home.tsx`, call `listDispatches`, render 3-5 headline rows above the stories strip. Add a language chip (EN/ने) per row from whichever of `title.en`/`title.ne` is present.
3. **RSS (0.5 day).** New `functions/feed.xml.ts`, clone the fetch loop from `functions/sitemap.xml.ts:31`. This is also what Facebook-page automation, Hamro Patro-style aggregators and fact-checkers consume.
4. **Dates (1 day).** Add relative time ("११ घण्टा अगाडि") to `format-date.ts`; BS date in the article byline via one small conversion function (no library, the arithmetic is a 100-line table). Keep Gregorian in metadata.
5. **Viber share + `article:published_time` (0.5 day).** One `viber://forward?text=` anchor in the share row; two OG tags in `og-meta.ts`.
6. **Footer honesty (0.5 day).** Link `GOVERNANCE.md`/`MODERATION-GUIDELINES.md` as routes, add a one-paragraph "how an article gets checked" line to `/articles`, pick one word for moderated content and one for official-source content.
7. **Fonts (1 day).** Self-host two Devanagari weights, drop to 400/600. Saves ~400 KB per Nepali page; fixes a top pain point ("speed").
8. **Then local updates, build-order step 1 only (3-4 days).** `kind: news` on DISPATCH plus the Desk queue. Skip step 2 (753-locality pages, GSI, picker) until a single municipality has ten published items. The empty-tier collapse logic is work spent on a problem you do not yet have.

**Do not build:** comments (2017 directive makes you liable, and you have no moderator capacity), push notifications (Hamro Patro's top complaint), dark mode, ad slots (steps 4 and 12 of the decisions doc; no audience to sell), the AI writer, Nepali URLs with hreflang (SEO plan 2.5; nothing to index yet), condolences, the ad-manager role, SSR. Do not register with DoIB this month: keep "local updates" wording, finish the content first, and spend the Rs 5,000 when there is a month of published items to register.

Total before local updates: about five coding days plus three writing days. The code is small because the pieces already exist; the risk is entirely that the owner spends the week on step 8 instead of step 1.

## Response B
**What I see in the first 10 seconds (360 px phone, Hetauda).** English. A big word "Live · updated 08:23" (live what?), a red bar of phone numbers, then a headline I half-understand and a paragraph I don't: *"designed to make response information easy to scan while keeping individual records behind an explicit name search."* No shopkeeper knows what an "individual record" or "explicit name search" is. I tap नेपाली (why isn't it already Nepali?), scroll, and find buttons about a flood that happened on 26 August. It is 14 October. Nothing tells me what is happening today, in Makwanpur, or anywhere. I go back to Facebook. Total time: eight seconds.

**Words that mean nothing to me:** OPMCM, NDRRMA, NPT, "Ledger" (a bank word), "Projects", "Our message", "Drones", "Coverage", "Audit", "Moderated community writing … editorial, not a forum". The hamburger lists 13 of these. On Kantipur I'd see राजनीति, समाज, खेलकुद and today's date "असोज २८, २०८३". Here the only date is "06 Sept 2026, 18:29 NPT".

**Things that confuse or break trust:**
- /articles: the only button is "Write an article", and below it "No articles match this filter." So there is nothing to read, but you want me to write? /stories: "Page not found."
- /search says *"verifiedNepal shows aggregate … status only. To search for a specific person by name, use the official OPMCM portal"*, then puts a "Search by name" box directly underneath. Which is it? And a Gulf worker typing "ram bahadur" in Roman gets nothing (cross-script search returns zero).
- Drop centres: "Last verified: 2026-09-08". Five weeks ago. Are they still open? I'd phone before travelling, which the page admits.
- /our-message: an English word cloud, "Don't Melt Us", "Justice, Not Charity", sent to foreign countries. On a disaster site. I have no idea why this is here or what "loss and damage" is.
- "Verified" by whom? The site never shows a person. Privacy page says "a single private individual". A Facebook page at least has a name, followers and a comment thread. Here there is no name, no phone, no office, no Facebook link.

**What is already right, from my seat:** no ads, no login to read, big buttons, hotline numbers on every page, Devanagari digits, "source:" lines, the fake-QR warning and "we never handle donations". That is more honest than most portals I visit.

**What the ideal looks like to me:** open it, it's in Nepali with today's BS date, the top says "आज, मकवानपुर" with 3-5 short items each stamped "२ घण्टा अगाडि · स्वयंसेवकले जाँचेको", one tap to share on Facebook/Viber/WhatsApp, the hotline bar, and a face or name I can call if it's wrong. RONB speed plus a "checked" stamp plus my palika.

**What to do first:**
1. Default to Nepali on first visit and rewrite the hero in words a shopkeeper uses: what happened, where to get help, who is missing. Delete the "explicit name search" sentence.
2. Hide every empty or 404 surface (articles, stories, projects, incidents) and cut the menu to five items until there's content. An empty "Write an article" page reads as abandoned.
3. Stop freezing the home page on August. Put a BS dateline and "last update" at the top; then build the local-updates strip, because it is the only thing on the roadmap that gives me a reason to return.
4. Put a named person, a phone number and a Facebook page in the footer. "Verified" means nothing without a who.
5. Fix the find-person contradiction and make Roman-Nepali search work. That is the one page a migrant worker actually needs.

## Response C
**The premise is the flaw.** The question asks what an ideal *news portal* looks like. The evidence says nobody is asking for one. `portal_traction_and_business_models.md`: 100 outlets closed and 243 journalists quit in 2023; the only ad-free membership (The Record) died; the two brands readers actually praise won on a *narrow daily utility* first (RONB on bandas and load-shedding, Hamro Patro on the calendar, "go-to" for 6.2%). `audience_habits_and_demographics.md`: ~8% trust online portals. Adding a 101st portal to that market is the bad deal.

**Alignment check, bluntly.** The site's one real asset is the aid/transparency stack: `/ledger`, `/audit`, `/coverage` with 3W export, "never handles money", a bilingual 23-section privacy page (`verified_nepal_public_site_inventory.md` §8). That maps directly onto the only adoption hook with evidence in the notes: `disaster_civic_information_seeking.md` KQ8, ward chairs in Rasuwa wanted "a public record proving relief had *not* arrived" while the CDO stopped answering phones. Nobody else does ward-level needs→delivery tracking (KQ5 inference). That is the gap. It is not journalism.

Where it is misaligned is worse than "missing features":

1. **Supply, not distribution, is zero.** Prod returns `{"items":[]}` for articles, stories, projects, centres and incidents (inventory, live-state facts). Six weeks after a 1,410-dead flood, with the editor, tags, bylines, share buttons and JSON-LD all built, volunteers published nothing. "Local updates" proposes 753 locality pages and a reporter role on top of a pipeline that produced zero at peak demand. That is a bigger empty room, not a fix.

2. **The verification brand is currently anti-verification.** Home "live" NDRRMA counts are hard-wired to one flood; the bundled snapshot is `synced_at 2026-08-29`; relief centres `last_verified 2026-09-08`; `llms.txt` still describes a single-flood dashboard (inventory §2, §12). "Verified" is used in five senses, and the green badge on OPMCM items means "official source", not "we checked" (inventory §8). The people who hold the verification role (`disaster_civic_information_seeking.md` KQ4) win on provenance: original source, timestamp, bulletin number. A stale "live" counter is the opposite.

3. **The legal exposure is designed in.** `publisher_journalist_moderator_side.md` KQ1: "any person … wanting to do online journalism" must register; the 2025 rules require a company, named editor, three bank-paid staff; the operator is "fully responsible" for content; PCN's practice is to order unlisted outlets to remove content and refer non-media accounts to the Cyber Bureau; ETA s.47 is live. The operator is "a single private individual" with a Gmail address. `NEWS-PORTAL-DECISIONS.md` #6 renames "news" to "local updates" — a label, not a defence. Worse, it switches to *post*-moderation and adds two ad slots, abandoning the one posture (pre-moderated, non-commercial mutual aid) that keeps this out of the "online media" bucket.

**What to do first: stop.**

- Do not start local updates. Get the lawyer's opinion the owner already decided to get (`NEWS-PORTAL-DECISIONS.md` DoIB note) *before* another line of that feature.
- Kill the staleness lie: un-hardwire the home page from the August flood, show honest "last verified" dates or remove the counters. A verification brand cannot ship month-old "live" data.
- Run a 30-day supply test on the surfaces that already exist: 20 published articles/stories on prod. If volunteers cannot fill `/articles`, no new surface changes that, and the question answers itself.
- Put the effort into the ward-chair record (`/coverage`, `/ledger`, needs→delivery). It is built, defensible, unique, and nobody can call it a news portal.

## Response D
**The ideal portal is not a news site. It is Nepal's "confirmed" layer, and the prize is bigger than anyone here is pricing.**

The research hands over the winning formula twice. RONB (portal_traction KQ3): one narrow daily-checked beat (bandas, load-shedding), verification before posting, 6-7 line posts, and readers now say news is "kind of 'confirmed'" once RONB posts it — 9.5M followers, no reporters. Hamro Patro (KQ4): a calendar utility that 1.7M people open daily, with news and then a Rs 100M/month remittance business layered on top. Neither is a newsroom. Both own habit, then monetise the habit. The ideal Nepali portal is a *status board* people check at 6-11 pm (audience_habits Q7) that answers "what is confirmed right now, and what does it mean for my ward?" — short, sourced, labelled, Nepali-first, with BS date in the masthead, and distributed as WhatsApp/Viber cards rather than as a destination site, because 69-83% of Onlinekhabar's traffic is already "direct/dark social".

**Verified Nepal is sitting on three assets nobody in the market has, and hiding all of them.**

1. A ward-level "what arrived where" ledger. disaster_civic KQ3/KQ8: ward chairs in Rasuwa wanted a public record proving relief had *not* arrived after 24 days; the CDO stopped answering phones; INGOs each duplicate sitreps (IFRC, LWR, PHASE). The inventory shows `/ledger`, `/coverage` with 3W CSV/GeoJSON export, and `/audit` already exist, masked and public — and are reachable only from the hamburger. This is the one thing BIPAD, NDRRMA Facebook and every portal lack (KQ5 inference: "no Nepali platform publicly tracks needs → offers → delivery at ward level"). It is also the one thing that cannot be forged with a logo.
2. A missing-persons search that already beats the state. The civil servant's GitHub dashboard beat the government portal by days (KQ2); Verified Nepal has `/search` over NDRRMA data — set to `noindex` (inventory §7).
3. Multi-sense provenance machinery: mandatory `Source:` on every article media block, "Official data snapshot · Updated HH:MM NPT" badges, "never handles money" copy. That is exactly the "provenance beats logos" trust marker from KQ4.

Misalignment is simply that none of this is shown as *content*. The home page surfaces zero headlines (§2 "Absent"), prod has zero articles/stories/incidents (§3), and the deepest proof assets sit behind a 13-item menu.

**What to do first: ship "Confirmed today" and make the ledger the front page.**

Do not build the full local-updates spec. Build its "Now" strip only, as the home page's first block, and feed it from what already exists: OPMCM/NDRRMA items the site already pulls, drop-centre verifications, ledger deliveries ("Ward 3, Uttargaya: 40 tarps delivered, confirmed by volunteer"), and the planned "Checked by volunteer / Not yet checked" labels. Every card a WhatsApp/Viber share with the badge baked into the PNG — the share-card pipeline already exists for climate and incidents. That is RONB's model with sources attached, which is the exact gap Kantipur's editor named ("hearsay, no original reporting").

Then the adjacent upside: the 3W export plus ward ledger is the product the 3.8M diaspora (Rs 2.36T remittances) and NRNA "watchdog" chapters would pay for or route through — donors already want "what reached Nepal" (KQ7). That is the Hamro Patro layer, and it never requires calling anything "news".

## Response E
You're asking what the ideal news portal looks like. Wrong question. Nepal does not have a shortage of publishers; it has 5,135 registered online outlets, 100 closing per year, and 92% reader distrust of all of them. What Nepal lacks is a **checkable record**. Strip the problem to its bones and three facts from the notes define it:

1. People **discover** on Facebook and **verify** on radio/TV (disaster_civic_information_seeking.md KQ1, KQ4). Nobody verifies on a portal. The verification seat is open, and it is won by provenance (bulletin number, original timestamp, official link), not by design or logos, which are forged.
2. In Aug 2026 "there was no centralized database" (volunteer Khadka); a civil servant's GitHub side project beat the state by days; ward chairs wanted a public record proving relief had **not** arrived (KQ8, Kathmandu Post 18 Sept 2026).
3. Becoming "online journalism" means a company, an editor, three bank-paid staff and operator liability for comments (publisher_journalist_moderator_side.md KQ1). A volunteer operation cannot legally be a news portal. Full stop.

**So the ideal is not a portal. It is a public ledger of claims.** One entry per assertion (deaths, missing, relief delivered to ward X, centre open), with: locality down to ward, provenance link, source timestamp, and a status label (official / checked by volunteer / unchecked). Permanent URL so a Facebook post or an FM host can cite it. RONB's moat (portal_traction KQ3) was a narrow beat that created a daily checking habit, then broadening. Distribution metric: how often you are cited, not visited.

**Alignment.** Verified Nepal already has the skeleton: `/ledger`, `/audit`, `/coverage` with 3W export, mandatory "Source:" on every media block, the Live/Snapshot badge, drop-centres "Last verified 2026-09-08", "never handles money" (inventory §8). That is the real product and it is buried.

**Misalignment.** The site is dressed as a magazine with nothing in it: prod returns `{"items":[]}` for articles, stories, projects, centres, incidents (inventory, live-state facts). `/articles` describes itself as "editorial… on mountains and climate" with seven climate-magazine tags; that is neither verification nor what readers lack. "Verified" means five different things (§8), the symptom of not knowing what you are. The home page is hard-wired to one flood with an NDRRMA snapshot from 2026-08-29. The planned "local updates" (docs/NEWS-PORTAL-DECISIONS.md) is post-moderated short local news with two ad slots and a reporter role: that is a news portal under another name, and it walks straight into DoIB.

**Do first.**
- **Stop** building local updates as specified. Re-cut it as the claim ledger above: `kind: claim`, ward scope, provenance required, status label. Same schema effort, no ad slots, no "reporters".
- **Pick one beat**: relief delivery per ward for the current disaster. Ward chairs are your motivated first users; they log "received X, need Y for Z households" against CDO claims. Nobody else in Nepal offers this.
- **Hide** every empty reading surface until it has content. Empty cards falsify "verified, not viral" on first visit.
- **Collapse "Verified"** to one meaning: a visible, dated provenance line on every item. Everything else is labelled by its source.
- Replace the Rasuwa hard-wiring with the existing multi-disaster model.

Articles, stories, climate messaging: keep the code, stop spending volunteer hours on them until the ledger is cited by someone.

