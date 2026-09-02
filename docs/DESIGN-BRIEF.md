# VerifiedNepal — UI/UX Redesign Brief

**Audience:** the UI/UX designer redesigning verifiednepal.com from scratch.
**Status:** 2026-09-02. Describes the product exactly as it ships today, so the redesign can cover every existing feature. Nothing here is a design decision for the new version unless marked **Constraint**.
**Companion reading:** `README.md` (what the site is), `docs/GOVERNANCE.md` (roles, scoping, audit), `docs/MODERATION-GUIDELINES.md` (how moderators work), the five role guides in `public/guides/*.pdf` (end-user walkthroughs with screenshots), and `.impeccable/critique/2026-09-01T14-22-04Z__src-app-tsx.md` (last heuristic review, 15/40, with the priority list).

---

## 1. What the product is

An independent, volunteer-run public-service site for the **2026 Rasuwa / Bhote Koshi flash flood** in Nepal. It does three jobs:

1. **Mirror official data** so affected people, relatives and donors get one fast, bilingual, mobile-first view: live rescue figures, person search, verified hotlines, relief map, official updates.
2. **Run a moderated mutual-aid portal**: people post needs, helpers post offers, moderators verify and match them, redeemed aid appears on a public masked ledger.
3. **Register organizations and drop centers** with a public goods ledger so in-kind donations are traceable from donor to distribution.

Non-negotiables that shape every screen (from `docs/GOVERNANCE.md` and `CONTRIBUTING.md`):

- **Verified is the product.** Nothing user-submitted is public until a human moderator approves it.
- **No money touches the platform.** The only donation link is the government PMDRF gateway. No wallets, QR codes, or fundraisers other than that one.
- **Minimal public PII.** Masked names, district/ward-level location only, auto-expiry.
- **Paper is an interface.** Ward lists, claim tokens and the ledger must print cleanly.
- **Every moderator action is public** on the audit log.
- **Not a government site.** Every page must make this clear and point to official sources.

## 2. Users and their situations

Design for these people, in this priority order.

| Persona | Situation | Device / network | Primary tasks |
|---|---|---|---|
| **Affected person / relative** | Stressed, possibly grieving, may be searching for a missing family member. Often reading Nepali. | Low-end Android, 2G/3G, intermittent. Often one-handed. | Call a hotline, search a name, learn what to do next, ask for help. |
| **Ward registrar** (community volunteer) | Registers many neighbours who cannot register themselves, from one phone, repeatedly. | Same phone all day, poor signal. | Submit a need on behalf of someone, keep their own contact details between submissions, hand the ref code to the family. |
| **Helper / donor** | Wants to give goods, transport, shelter, skills, or money. Wants proof it arrived. | Mixed; often diaspora on desktop or good mobile. | Browse published needs by district/category, post an offer, donate to a drop center, check donation status, read the ledger. |
| **Organization owner / member** | Runs a relief org or a drop center. | Laptop or mid-range phone. | Register org, get verified, manage centers, record intake/distribution/transfer, publish needs list, see flags. |
| **Moderator** (district-scoped) | Trusted local: teacher, health worker. Works a queue for hours, often on mobile between calls. | Mobile and laptop. | Verify by phone, publish/reject, match, redeem claim codes, print ward sheets, handle flags, verify orgs. |
| **Admin** | Portal operator. | Laptop. | Everything a moderator can do, plus roles, district scope, stats. |
| **Screen-reader / low-vision user** | Any of the above. | Any. | Everything, via keyboard and assistive tech. |

Accessibility is a first-class requirement, not a persona. See §11.

## 3. Constraints the redesign must respect

- **Constraint: Bilingual, English and Nepali, equal citizens.** Every string exists in both. Layouts must survive Devanagari (taller glyphs, longer strings, no small-caps or letter-spacing tricks). The wordmark switches language. Nepali digits are used for numbers in Nepali mode.
- **Constraint: Mobile first, 320px minimum width, no horizontal scroll anywhere.** The crisis audience is on cheap Android phones.
- **Constraint: Fast on 2G.** Current budget: main JS chunk ~330 kB, fonts ~230 kB on the front page. The redesign should not add font families or heavy assets. Satellite map tiles are already the heaviest thing on the page and load only when expanded.
- **Constraint: Works offline as a PWA.** Data snapshot, previously visited boards and pages are cached. The UI must show clearly whether data is live or a snapshot.
- **Constraint: Printable.** Claim sheets, ledger, and drop-center needs lists are printed on A4 by ward offices. Provide print layouts.
- **Constraint: Tap targets minimum 44 px.** Text-scale control up to 150%. High-contrast mode. Everything must reflow at those settings.
- **Constraint: No cookies, no analytics, no trackers.** Sign-in tokens only, for the portal.
- **Constraint: Component stack is React + Tailwind + a small set of shadcn primitives.** Deliver a token system and components that can be built with that stack. No design that requires heavy animation libraries.
- **Constraint: Every page sets a title, moves focus to main on route change, and announces loading/errors to assistive tech.**

## 4. Current visual system (what exists, what to keep or replace)

The current design is a black-and-white "newsprint" editorial system. It is coherent but only half the site wears it: community and Desk pages still use stock shadcn cards. The last review called it "a newspaper costume on a crisis tool". You are free to replace it. Whatever you propose must be a single system that covers the public site, forms, org dashboard and Desk.

### 4.1 Tokens in use today

| Token | Value | Role |
|---|---|---|
| paper | #FFFFFF | page background |
| ink | #0A0A0A | text, primary buttons, rules |
| muted | #6B6B6B | secondary text |
| rule | #E3E3E3 | hairlines, borders |
| red | #DC143C (Nepal crimson) | urgency: emergency line, missing count, donate, errors, focus ring, selection |
| blue | #003893 (Nepal blue) | official / verified source: live badge, official links, verified marks |
| radius | 0 | everything square |

High-contrast mode swaps to pure black ink, black hairlines, deeper red and blue, and 2 px underlines.

Known problem: **red is overloaded** (emergency, missing, donate, focus, error, destructive, primary hover). There is **no status palette**; statuses are drawn with glyphs only (● ○ ◐ ✓ ✕ ▢). The redesign needs a status color system that survives high-contrast and grayscale, and a separation of "emergency", "error" and "call to action".

### 4.2 Type

- Display: Playfair Display 700/900 (Latin), Noto Serif Devanagari 700.
- Body: Source Serif 4 400/600, italic 400; Noto Serif Devanagari.
- UI labels, tables, forms: system sans (Android's Noto Sans Devanagari for Nepali).
- Root size is 125% by default (user can step 100 to 150%).
- Eyebrows are tracked uppercase in English and plain in Nepali.

Known problems: 12 tracked eyebrows on the front page; 11 px Devanagari labels; tiny sans labels do not scale well.

### 4.3 Brand assets available

`public/brand/`: logo-mark.svg, logo-mark-light.svg, logo-horizontal.svg, logo-horizontal-light.svg, logo-stacked.svg. PWA icons 192/512/maskable. Wordmark reads "Verified Nepal" / "भेरिफाइड नेपाल". PMDRF QR code SVG (official donation gateway, keep).

### 4.4 Existing primitives (for reference)

Rule (single/double), SectionLabel (eyebrow with optional red/blue dot), Headline, Standfirst, Byline (source + updated time), SquareButton (outline / primary / red, optional external arrow), RuledTable (label, value, optional proportional bar), StatusMark (glyph + label), SimpleMarkdown, plus shadcn button, card, dialog, input, label, select, separator, table, textarea, badge.

## 5. Global shell

Present on every page unless noted.

### 5.1 Accessibility bar
Top of page. Text size A− / A / A+ (five steps, 100 to 150%), high-contrast toggle, language toggle EN | नेपाली. Persists per browser. On mobile it collapses to an "Aa" button plus the language toggle.

### 5.2 Masthead
- Desktop: three columns. Left: district list "Nuwakot · Rasuwa · Sindhupalchok · flood name" and a small "Desk" link. Center: large wordmark in the current language with the other language beneath. Right: edition line "Edition · date · Day N of response · live/snapshot badge".
- Mobile: one slim row: districts + Desk link, wordmark, live badge.
- Desk (signed-in work surface) uses a compact single-row header: wordmark, "Desk" label, emergency 1234 link, then nav. No emergency strip.

### 5.3 Primary navigation
Nine items: Find a person, Get help, Give help, Drop centers, Info / Help, Projects, Dispatches, Ledger, Audit. Active item underlined. Language toggle at the right on desktop. Known problem: nine items is too many for mobile; earlier fix added a "More" overflow. Desk and My organization are reached from masthead/footer, not the nav.

### 5.4 Emergency line
Below the nav on all public pages: red dot + "Emergency" label, then tappable numbers 1234 (disaster hotline), 100 (police), 102 (ambulance). Each is a tel: link.

### 5.5 Footer
About paragraph, data source + last synced + live badge, links: NDRRMA, official donation appeal, GitHub, contact email, My organization, Audit log, "Someone is missing" guide, Privacy & Disclaimer. Bottom line: "Unofficial · Powered by OnlyUtils" and "Set in …" colophon.

### 5.6 Global behaviors
- Skip-to-content link.
- Back-to-top square button appears near the foot of long pages.
- Live status badge: blue dot "Live · updated HH:MM" or hollow dot "Snapshot · date" with tooltip. Data refreshes every 5 minutes.
- Chat widget launcher (bottom right, brand mark). Opens an AI assistant grounded in the live data. Greeting: "I'm here to help. Ask about rescued or missing people, relief locations, or how to get help." Knows the visitor's selected district. Its look is fully ours to theme. Known problem: the launcher covers help text, Print and CSV buttons on mobile.
- Loading fallback is a plain "Loading…" line. Every portal page is wrapped in an error boundary with a retry.
- Route change: title updates, focus moves to main, scroll to top.
- `/search` is noindex. No person list is ever browsable in bulk.

## 6. Public information pages

### 6.1 Front page `/`
Order today, top to bottom:

1. **Action triad**: Call 1234 (red), Find a person (primary), Get help (outline). Full width on mobile, three-up on desktop.
2. **Lead**: eyebrow "Official figures" (blue dot), headline built from live numbers ("N rescued, M missing…"), byline (source NDRRMA, updated time), standfirst, and the official messages block (quoted government notices).
3. **By the numbers** table: rescued, missing (red), out of reach, forces deployed, verified records. Flood date note. Below it: Find a person button, Register your organization button, and links to the five PDF guides (Seeking help, Providing help, Organization, Writing a dispatch, Moderator).
4. **Relief map** plate: district filter (All areas, Nuwakot, Rasuwa, Sindhupalchok) as tabs on desktop and a select on mobile; Show/Hide map toggle (collapsed by default on mobile); grayscale satellite map with pins for affected locations and relief camps; selected pin recenters; Clear selection button; map locked against accidental drag on touch until unlocked.
5. **Affected districts** list: grouped by district, each location a button that selects the pin; "(approximate)" and "not mapped" markers; "N/M locations mapped" counter; relief camps "near you" block when a district is chosen.
6. **Three columns**: Missing persons (lead, "not being listed is not proof" note, Search by name and Report a missing person buttons to the OPMCM portal); Help requests from OPMCM (open, critical, in progress, resolved, offers available, Ask for help button); Official updates (latest three government updates with dates, link to OPMCM).
7. **Emergency contacts**: full list of ten verified hotlines, each tappable, number in red. See list in §6.5.
8. **Public notice** (boxed): Donate to the PM Disaster Relief Fund, Donate button (red, external), Verify the appeal button, warning about scams, QR code and URL.
9. **Tables row**: Status of records (each status with count, percent and bar); By nationality (scrollable list with bars).
10. **Ask the desk**: one line describing the AI assistant and an Open button.

### 6.2 Find a person `/search`
Eyebrow, title, intro, two buttons: Search by name (OPMCM portal, primary) and "Someone is missing" guide (red). Then By the numbers and Status of records tables, then an official-disclaimer block quoting NDRRMA messages. Name search itself is delegated to the government portal today; the earlier in-page search (English/Devanagari, order-independent, diacritic-folded, across rescued and missing lists) exists in the codebase and should be designed for, including result cards, "no match" and "source unavailable" states.

### 6.3 Someone is missing `/missing`
A step-by-step guide for families: (1) search the official lists, (2) register on the OPMCM portal with the list of details to have ready, (3) file with police and the District Administration Office, (4) ask the hospitals (named), (5) if they were near the Rasuwagadhi border, (6) unidentified persons list with a care warning, (7) protect the family (one contact person, no one will ask for money). Each step has a CTA where relevant. Ends with the volunteer contact email and the emergency contacts list.

### 6.4 Info / Help `/info`
Emergency contacts, public donation notice, About, Data source with last-synced time, Official contacts links (NDRRMA, MoHA, rescue portal), Responding organizations links (Direct Relief, Oxfam, CARE, UNICEF).

### 6.5 Verified hotlines (content, do not alter)
1234 disaster hotline · 1112 flood control room · 100 police · 102 ambulance · 101 fire · +977 1 4211208 MoHA landline · +977 974 444 1227 MoFA for foreign nationals (7am to 10pm, WhatsApp) · 1130 Red Cross · 1098 child helpline · 1144 tourist police.

### 6.6 Privacy & Disclaimer `/privacy`
Twenty-three numbered sections in both languages (operator, terms, third-party data, what is collected, why, what is public by design, retention, who sees private data, correction and removal rights, consent when registering someone else, moderator accountability, no money, cookies and sign-in storage, third parties, permitted use, IP, no warranty, liability, availability, children, governing law, severability, changes and contact). Needs a readable long-form layout with a sticky or jump table of contents.

## 7. Mutual-aid portal (public)

Shared vocabulary for this whole section:

- **Districts**: exactly three, Rasuwa, Nuwakot, Sindhupalchok. Wards are numbers only.
- **Categories** (six): Goods, Shelter, Transport, Medical, Skilled labor, Funds guidance.
- **Turnstile** (Cloudflare human check) sits below forms when configured; otherwise a small grey "Verification may be required" line. It has no visible error state when a token expires.
- **Masking is done by the server.** Public boards, ledger and audit show masked names such as "R. Gurung" and never real names, phones or addresses.
- **Three bearer codes** exist and must be visually distinct: the **reference code** (a need's owner credential), the **claim code** (shown at the ward to collect aid), the **update code** (a project committee's credential). All are letters and digits, shown in monospace. Latin-only today.
- **Error copy** is plain language: offline, expired sign-in, rate limited, generic server error with the contact email, out of scope district, guidelines not acknowledged.

### 7.1 Get help `/get-help`
Purpose: an affected person, or someone acting for them, registers a need without an account. Also where an existing request's status is checked.

- Narrow single column. Title "Get help — register a need", lead explaining that a moderator reviews before anything is public.
- **Draft restore bar**: the form autosaves to the browser; on return shows "Draft restored from {time}" with Discard.
- **Who is this for?** segmented control: Myself / Someone else. "Someone else" reveals a registrant block: your name (required), your phone (required, 7 to 15 digits), your email (optional) and a required **consent checkbox** with the hint that details stay private until a masked listing is published.
- **Who needs help** block: full name (required), phone (optional, moderator contact), email (optional), district (required select), ward number (required, 1 to 35), household size (optional).
- **What is needed**: category select (defaults to Goods). **Describe what is needed** textarea, required, no limit or counter, hint "Be specific… No need to share citizenship numbers."
- Validation runs on submit: inline red message per field, a summary strip "N fields need attention", focus jumps to the first invalid field, errors clear on edit. API failure shows a red alert above the button.
- **Success dialog** (cannot be dismissed by clicking outside): "Request received", the reference code in very large monospace, **Copy code** (flips to Copied), a "What happens next" explanation, an embedded status checker prefilled with the code, and **Register another person**, which is disabled until the code has been copied. Registering another keeps the registrant's details and mode so a volunteer can register many people in a row.
- **Check status** card (also at the bottom of the page): code input, Check button, result line "status · category · district" plus created and expiry dates. When published or matched, a boxed **claim code** with "Show this code when you collect aid" (no copy button today). **Renew for 30 days** button.
- **How aid is prioritised** explainer: severity of damage, vulnerable members, no prior aid; note that moderators still verify in person.

### 7.2 Give help `/give-help`
Wide page, three stacked sections.

- **Needs board**: filters District (All + 3) and Category (All + 6) beside the heading; no sort, no pagination. States: loading, red error, empty with an offline note. Cards three-up on desktop: category badge, "District · W{ward}", masked name as title, created date, description clamped to four lines with no detail page, footer with **Share** (copies a link; falls back to a browser prompt if clipboard is blocked), **Report a problem**, and a status badge.
- **Report a problem dialog**: reason radios (Already received aid, Not a real need, Other), optional details with a 500-character live counter, Turnstile, Cancel / Submit report. Success replaces the body with a thank-you; its close button is mislabelled "Cancel".
- **Register an offer**: signed out shows a "Sign in to offer help" card with Continue with Google. Signed in: "On behalf of an organization" checkbox revealing org name and org contact; **What can you help with** multi-select chips (categories, at least one); **Districts you can help in** chips (at least one); description textarea; phone (required, no format check today) with the note that only moderators see it; email optional. All validation failures collapse into one generic "This field is required" line. Ghost Sign out below.
- **Offer success**: "Offer received" card with the offer id as reference (no copy button), "What happens next" (a moderator will call you), and no way back to the form.
- **Recent offers**: own district and category filters, two-up cards showing masked helper label, organization, description, category badges, districts and date. No contact details ever. Errors fail silently to empty.

### 7.3 Community projects `/projects`
Public board of infrastructure projects (tuin cable crossings, bridges, trails, water, schools) that donors fund directly through the committee's bank details.

- Header with two CTAs: **Register a project** and **Post an update**.
- Filters card: District, Status (published, in progress, completed; shown as raw lowercase values today), Try again / refresh. Cursor-based **Load more**.
- States: loading, error box with an offline note, empty.
- Card: 176 px cover image or a "No photo yet" placeholder; type badge (Tuin, Bridge, Trail, Water, School, Other) and localized status mark (Pending, Published, Matched, Fulfilled, Rejected, Archived, In progress, Completed); title clamped to two lines (Nepali title when available); "District · W{ward} · NPR amount"; **View details** and **Copy link** (no copied feedback today).

### 7.4 Project detail `/projects/:id`
- Back link, badge row (type, status, **Verified committee** or **Not yet verified**), title, meta line with district, ward, location text and cost.
- Left column: **Photos** grid (empty: "No photos yet"), **About this project**, **Progress updates** with count, newest first, each with timestamp, optional "NPR spent", text and photo strip (empty: "No updates yet — check back for photo proof of progress").
- Right column: **Support this project** card. When verified: Bank, Account name, Account number, optional eSewa and Khalti, each row with its own Copy button. When not verified: "Payment details will appear after a moderator verifies the committee." Always an amber warning that money goes directly to the committee and VerifiedNepal never handles funds. **Share this project**: Copy link, WhatsApp, Facebook.
- States: loading, not found, offline/error with back link.

### 7.5 Register a project `/projects/register`
No account. Three cards then Turnstile and submit.

- **Project details**: title English (required, 120 chars), title Nepali (optional), description English (required, 2000 chars), description Nepali (optional), project type (raw values today), district, ward (1 to 33), cost estimate NPR, location description with example placeholder.
- **Responsible committee**: committee name, contact person (private), contact phone (private, placeholder +977-98XXXXXXXX, no format check), contact email (private, optional).
- **Committee bank account (for donors)**: bank name, account holder, account number, eSewa id and Khalti id optional.
- Validation collapses into one generic message with no field highlighting.
- **Success**: "Project received", the **update code** in very large monospace with Copy code and "shown only once" warning, "What happens next" (a moderator calls the committee before publishing), View project and Back to projects. Nothing forces copying the code before leaving.

### 7.6 Post a progress update `/projects/update`
Narrow form: project id or link, update code, update text (2000 chars), amount spent NPR (optional), photos (JPEG, PNG, WebP; downsized to 1600 px before upload; only the first five are kept, silently). Selected files list with size and Remove. Upload progress line "Uploading: n/total". Success banner above the form with a View project link. Errors are a single line; some image errors are raw English today.

### 7.7 Dispatches `/dispatches` and `/dispatches/:id`
A moderated editorial feed of community writing on mountains and climate. Explicitly not a forum: no comments, no threads, no reactions.

- Header with **Write a dispatch** (scrolls to the form). Tag filter pills: All, climate, mountains, floods, landslides, glaciers, community, story (single select).
- Ruled list, not cards: tag badges, headline, three-line excerpt, meta "By name · place · date", Read dispatch link. Cursor Load more. Loading, error with Try again and offline note, empty.
- **Write a dispatch** form: title (200 chars), body (6000 chars, live counter that warns near the limit, markdown-lite), display name, place (optional), email (private, required, validated), language select (defaults to site language), tags (up to three, others disable at three). Turnstile required when configured. One generic validation message. Success panel with an "again" button that clears the form.
- **Detail**: back link, tags, headline, meta, long-form serif body; actions Copy link, WhatsApp, Facebook, Print; print stylesheet strips chrome. States: loading, not found or not yet published, offline note.

### 7.8 Ledger `/ledger`
Public, printable record of aid actually handed over.

- Controls: District (one always selected, defaults to Rasuwa, no "all"), Ward (All wards, W1 to W33), **Print**, **Download CSV** ("CSV for journalists and researchers"), Turnstile.
- Table: Name (masked), Category, Ward, Date. Horizontal scroll on narrow screens. Print: chrome hidden, black bordered table, rows kept whole.
- States: loading, error, empty "No fulfilled aid yet for this filter", offline note about cached copy.

### 7.9 Audit log `/audit`
Public accountability log of every moderator action, print-first.

- Header lead "Every moderator action is public — moderators are accountable to the community too."
- Controls: Month (last 12 months, raw YYYY-MM today), Print.
- Table: Time, Actor (masked moderator name), Action (raw code such as `publish`), Target (type + masked label), Reason or a dash. Newest first. Cursor Load more.
- States: loading, error, empty "No audit entries for this month".

### 7.10 Inconsistencies in this section the redesign should settle
- Codes: reference code has copy and a gate; claim code and offer reference have no copy; update code has copy but no gate.
- Validation: per-field on Get help, one generic line everywhere else.
- Ward maximum 35 on Get help, 33 elsewhere.
- Character limits are silent except the dispatch body.
- Raw enum values leak on project status filter, project type, ledger category, audit action and month.
- Needs and offers boards have no pagination; every other list has Load more.
- Phone inputs have no prefix, mask or formatting; only Get help validates digits.
- Touch targets: 44 px on Get help, 32 to 36 px on other portal pages.

## 8. Organizations, drop centers and goods ledger

Organizations sign in with Google, register once, and are verified by moderators afterwards. Their **drop centers** are public collection points. Every movement of goods (intake, distribution, transfer, correction) is a public **goods ledger** entry. Vocabulary to reconcile: the public side says "Receiving paused" and "Verified", the dashboard says "Paused" and "Verified — self-declared".

**Verification tiers**: Provisional (pending, publicly badged "Unverified"), Known (on a seed list or established), Vouched (an already-verified org vouched), Self-declared (moderator checked what they could). Statuses: pending, verified, rejected, suspended.

### 8.1 Register an organization `/register-organization`
- Single long form, narrow column, no wizard. Lead explains anyone signed in with Google can register and moderators verify afterwards.
- **Signed out**: gate card "Sign in to register" with Continue with Google; "What happens next" box beneath.
- **Signed in banners**: "You already have a registered organization" with a My organization button (non-blocking); "Draft restored from {time}" with Discard draft (autosaved); validation summary "N fields need attention" with focus to the first invalid field.
- Fields: organization name (2 to 150), organization type (NGO, Community group, Company, Religious organization, Government, Other), registration number (optional), contact person, contact phone (7 to 15 digits), contact email (optional, prefilled from Google), working districts (chip grid, 1 to 10), about the organization (10 to 2000), website (optional). Inline error per field.
- Submit "Register organization" then straight to `/org`. There is no separate thank-you screen; the dashboard's pending state is the confirmation.
- **What happens next** box lists the tier ladder and says centers can be created immediately but are badged unverified.

### 8.2 My organization `/org`
One long scrolling page, no tabs. Order: header, org switcher, identity card, vouch boxes, offline queue banner, Staff, Drop centers.

- **Whole-page states**: signed out gate "Sign in to see your organization"; loading; error with retry (button currently mislabelled "Load more"); no organizations yet with a Register your organization button.
- **Organization switcher**: select, only when the user belongs to more than one org.
- **Identity card**: name, status mark, type, contact line, districts, description, website, Vouches list, and **Edit organization** (owner only; others see "Only the owner can edit this"). Status mark values: "Unverified — publicly visible as unverified", "Verified — known / vouched / self-declared", "Rejected — Reason: …", "Suspended — Reason: …".
- **Pending**: box "Ask a verified organization to vouch for you" showing the organization id in monospace with Copy ID.
- **Verified owner**: box "Vouch for an organization" with a pending organization id input and Vouch button; one vouch per organization.
- **Offline queue banner** (amber, live region): "N entries waiting to sync" with Retry; goods entries logged while offline queue locally and flush when back online.
- **Staff** (owner only): table Email, Name, Role (Owner / Staff), Status (Member / Invited), Added, Remove. Invite by email row; success reads "Added" or "Invited — they will join when they sign in with this Google email". Remove confirm dialog. No role editing; ownership is fixed.
- **Drop centers**: heading with **Add drop center** (owner). Empty "No drop centers yet. Add one to start receiving goods." Each center is a collapsible card: name, "district · status", Open / Paused / Closed badge, Show details toggle. Expanded blocks:
  1. **Details and status**: address, hours, accepted goods badges; owners get a status select (Open, Paused, Closed) that saves immediately.
  2. **Stock on hand**: table Category, Quantity with unit. Empty "No stock yet — log an intake."
  3. **Log entry form**: radio Intake / Distribution / Send to another center. Sending reveals destination: a drop center on VerifiedNepal (select of other public centers "name — district — org") or somewhere else (free text, 200 chars). Category select, quantity (greater than 0, two decimals, max 1,000,000), note (500 chars). Full-width Log entry. When offline the entry queues silently and the amber banner appears.
  4. **Inbound transfers awaiting confirmation**: rows "From {center}", category, quantity, date, **Confirm received**. Dialog "Confirm receipt" with quantity received prefilled, a live "Discrepancy: …" line when it differs, optional note.
  5. **Donor drops awaiting confirmation**: heading with **Print QR for donors**. Rows show category, quantity, note, the drop code in monospace, declared date, and **Confirm received** / **Not received**. Confirm dialog with editable quantity; confirming creates an intake entry. QR dialog shows a 240 px QR of the center's "I dropped something here" link, the URL, and Print.
  6. **Recent activity** (the ledger): each row has a type badge (intake, distribution, transfer_out, transfer_in, correction shown raw today), category, quantity, optional red discrepancy, "corrected" badge with strikethrough when reversed, a transfer line ("Sent to X · in transit / received", "Received from X"), note, timestamp and author. **Correct** button opens "Correct this entry" with a required reason (3 to 500 chars); a correction reverses the entry and the user logs a new one. Load more.
- **Add drop center dialog**: center name, district and ward (1 to 33), address, latitude and longitude (both or neither, Nepal bounds), opening hours, contact phone, accepts (category chips, at least one), notes. Cancel / Create center.
- **Edit organization dialog**: same nine fields as registration, prefilled.

### 8.3 Drop centers directory `/drop-centers`
- Eyebrow "Relief network", title, standfirst noting that figures are logged by the organizations themselves and not independently verified.
- Filter card: District (All + 3), **Show map** (only when any center has coordinates). Map: OpenStreetMap, crimson pins, hover shows "center · org", collapsed by default.
- States: loading, error with Try again, empty ("No centers in this district yet" / "No drop centers have been listed yet").
- Cards one to three across: center name, org name with verification badge (Known organization, Vouched for, Verified, or outline Unverified organization), "District · Ward n", address, hours, **Accepts** badges, status mark Open / Receiving paused / Closed, **View center**. Load more.

### 8.4 Drop center detail `/drop-centers/:id`
- Back link, eyebrow, badge row (org verification, org name, center status), center name headline. Details: address, district and ward, hours, phone as tel link, Accepts badges.
- **Stock on hand** ruled table with footnote "Stock on hand = received − distributed − sent out".
- **Recent activity** ruled list: Received / Distributed / Sent to X / Received from X / Correction, with category and quantity, corrected entries struck through, red discrepancy, timestamp, note.
- **Report a problem**: collapsed button; expands to reason select (does not exist, closed and should be hidden, misuse of goods or funds, other), optional details (500 chars), Turnstile, Submit report / Cancel, green thank-you on success.
- **Donor flow "I dropped something here"** (design it; the strings and logic exist but the button and dialog are not rendered today, so donors arriving from the printed QR currently see nothing): opens from a button or automatically from the QR link; dialog "Declare your drop" with category, quantity, optional note, Turnstile, **Get drop code**; success shows the drop code with Copy, the status link, and "Keep this code. Staff will confirm when they log your drop; the code never shows who received the goods."
- States: loading, not found card with Back to all centers, other error.

### 8.5 Donation status `/donation/:ref`
- Public, narrow. Title "Your drop". A **Look up another code** input (uppercased) with Check, always visible.
- Found: the code in large monospace beside a status mark: "Declared — not yet confirmed by staff", "Logged as received on {date}", or "Staff could not find this drop — contact the center". Ruled table: Center, Category, Quantity, Status with declared date. Optional pull-quote "Since your drop was logged, this center has distributed X and sent on Y of {category}." Footnote about keeping the code. **View center** link.
- States: loading, not found card, error (no retry today).

### 8.6 Inconsistencies in this section
- Raw machine values shown to users: org type, center status in the collapsed card, ledger entry types, transfer status.
- Every Cancel button in the org dialogs is untranslated English.
- The dashboard's "donor drops" list is a free-form row where a table was intended.
- Center status wording differs between public and dashboard.

## 9. The Desk (moderator and admin)

The Desk is the signed-in work surface for moderators and admins. It uses the compact header (§5.2). Everything a moderator does here is written to the public audit log with their name. Read `docs/MODERATION-GUIDELINES.md` before designing it: the UI must make the guideline steps (call first, mask, preset reasons, handle claim lists carefully) the easy path.

### 9.1 Before the Desk (full-page centered card)
| State | What the user sees |
|---|---|
| Signed out | "The Desk", "Moderation is invite-only", **Continue with Google** |
| Sign-in not configured | Same card, muted "sign-in not configured yet", no button |
| Sign-in failed | Red alert line under the button |
| Checking session | "Checking your account…" (no spinner) |
| Auth error | "Authentication error", Continue with Google and Sign out |
| Wrong role (helper) | "Not authorized… moderation is by invitation only", "Signed in as {email}", Sign out |
| Guidelines gate (moderators, once) | Wide card with the full guidelines in a scrollable box, checkbox "I have read and will follow the moderation guidelines", confirm button; admins skip it |

### 9.2 Desk shell
- Header: "The Desk", "Signed in as {name}", **Sign out**.
- **Tab bar** (wrapping, underline active): Queue · Published boards · Print claim list · Paper sync · Flags · Projects · Dispatches · Organizations · Admin (admin only). Count suffixes on Queue (pending needs), Flags, Projects, Dispatches, Organizations (pending). Counts are unfiltered, so a scoped moderator can see "Queue · 12" above three rows.
- **Scope**: badge "Scope: Rasuwa" or "All districts" on Queue and Boards; hint line "Queue, boards, print and claims are filtered to your districts." Scoping applies to Queue, Boards, Projects, Print. Not scoped: Flags, Dispatches, Organizations, Paper sync, Admin.
- **Feedback**: red error banner (persists until next action); ruled success banner "Updated" / "Redeemed" (auto-dismisses after 6 s). Dialog errors stay inside the dialog.
- Tabs are plain buttons, no arrow-key navigation, no keyboard shortcuts anywhere. Loading is text only.

### 9.3 Queue (pending needs, oldest first)
- States: "Loading queue…", error with Retry, empty "No pending items — queue is clear."
- **Card**: masked name, category, red "{n} flags" badge, status badge; meta "district · W{ward} · created". Two columns: **Public preview** (what the board will show: masked name, district and ward, category, description) and **Private details, moderators only** (beneficiary name, phone, email, household size; registrant name, phone, email or "No registrant — self-registered"; **Possible duplicates** list by same name and ward).
- Checkbox "I called the registrant and confirmed the details" gates **Publish** (disabled until ticked). **Reject** opens a dialog.
- **Reject dialog**: required reason select (Not consented, Duplicate, Unreachable, Out of scope, Insufficient detail, Other), optional details, helper "The registrant hears this reason when called", Cancel / Reject.
- Missing today and required by the guidelines: a way to edit the description (remove phone numbers) before publishing.

### 9.4 Published boards
- States: loading, empty "No published needs" (a failed load looks identical, no error state today).
- **Card**: masked name, flags, status (published, matched, fulfilled, archived); meta; **Claim code** panel in large monospace; description. **Match row**: offer select ("helper label — categories (id)"), **Match** (no confirmation), **Fulfill** (confirm), **Archive** (confirm), **Redeem** (primary, only when published or matched with a claim code). After a match: boxed **"Matched — share this contact"** with the helper's contact fields.
- **Redeem dialog**: restates the code, warns it cannot be undone without admin help, optional note. Outcomes: Redeemed, Already redeemed, Unknown code.

### 9.5 Print claim list
- Lead "Pick district + ward to render a paper-ready sheet for field distribution. Works offline after first load."
- District select (limited to scope), Ward select W1 to W33, **Load list**, **Print this sheet**.
- Sheet: heading "District · W{ward}", table with tick box, QR of the claim code, claim code in bold monospace, masked name, category. Print hides chrome and keeps rows whole. Empty "No claims in this ward for published or matched needs."

### 9.6 Paper sync
- Lead "Type one code per line (optionally add a note after a space). These were redeemed offline from the printed sheet."
- Monospace textarea, **Sync**. Validation: at least one code, at most 200. Results list per code: redeemed (green), already redeemed (amber), unknown (red).

### 9.7 Flags
- **Flagged needs**: read-only inbox; card with masked name, ward, flag count, district, id, then each flag's reason, details and time. Action is taken from Queue or Boards.
- **Flagged centers**: card "center · district", org name, **View public page**, list of reasons. Read-only.

### 9.8 Projects (oldest first, scoped)
- Card: title, status badge, **Verified** / **Not verified** committee badge, district and ward, id, type, cost, description, location, photo strip, **Private committee contact** panel (contact name, phone, email, bank, eSewa, Khalti).
- Actions: **Verify committee** (confirm dialog "I called {contact} at {phone}"), **Publish** (blocked until verified, with tooltip), **Reject** (reason dialog), status select + **Set status** (pending, published, in-progress, completed, rejected, archived; immediate).
- **Pending photos**: thumbnail, caption, Publish photo / Reject photo. **Pending updates**: text, spent, photos, Publish update / Reject update (canned reason, no prompt today).

### 9.9 Dispatches (oldest first, not scoped)
- Card: title, status, "By name · place · date · tags", full body, **Private** panel with the author's email ("Never public"). **Publish** (immediate), **Reject** (reason dialog).

### 9.10 Organizations
- Status filter select: Pending (default), Verified, Suspended, Rejected. Try again.
- Card: name, status badge, "Type · Registration no. · Registered · N centers", contact name, phone (tel link), email, owner email, districts, website, description, **Vouches** list, **Tier** panel with the verification note, rejection or suspension reason.
- Actions by status: pending → **Verify** (dialog: tier select Known / Vouched for / Self-declared, required note of at least 5 characters, both shown publicly) and **Reject** (required reason, shown to the owner); verified → **Suspend** (required reason; centers hidden); suspended → **Reinstate** (immediate); rejected → none.

### 9.11 Admin (admin role only)
- **Lookup user by email**: input + Lookup; "No user found" or failure line. Result: email, name, id; current role, districts, guidelines acknowledged or not; **Role** select (helper, moderator, admin); **Districts** checkbox grid (empty = all); **Save role** with confirm dialog "Change {email} to {role} with districts […]? This will be audited." Errors: cannot demote yourself, out of scope, guidelines not acknowledged.
- **Moderators** roster: rows of email, name, role, districts, created date. Read-only.
- **Stats**: needs pending and published, offers pending, projects pending, oldest pending age (turns red and bold with "Over 48h — needs attention"), moderator count.

### 9.12 Confirmation matrix (keep or improve, never weaken)
| Action | Gate today |
|---|---|
| Publish need | "I called the registrant" checkbox |
| Reject need / project / dispatch | Required reason code + optional details |
| Match need to offer | None |
| Fulfill, Archive need | Confirm dialog |
| Redeem claim | Dialog restating code, cannot be undone, optional note |
| Verify committee | Dialog "I called {contact} at {phone}" |
| Set project status, publish/reject photo or update, publish dispatch, reinstate org | None, immediate |
| Publish project | Blocked until committee verified |
| Verify / reject / suspend org | Dialog with tier or reason (5+ chars) |
| Change a user's role | Confirm dialog, audited |
| Paper sync | Max 200 codes |

### 9.13 Desk gaps to fix in the redesign
- No filters, search, sort, bulk actions or keyboard shortcuts in any queue.
- No edit-before-publish for need text.
- Boards has no error state; Queue Retry is untranslated; a few private labels untranslated.
- Photo and update rejection has no reason prompt.
- Tab counts ignore scope.
- Everything is a card; dense table views for long queues are needed on desktop.

## 10. Cross-cutting flows to design end to end

1. **"I need help" on a phone with one bar of signal**: front page → Get help → form (draft survives refresh) → confirmation with ref code → status lookup later → claim code → redeem at ward → ledger row.
2. **Registrar registering fifteen neighbours**: contact and consent details persist between submissions; one-tap "register another"; codes legible on paper.
3. **Helper matching a need**: Give help → filters → need card → sign in with Google → post offer → wait for publish → see it on the board.
4. **Donor to drop center**: Drop centers → filter by district → center detail with needs and hours → record donation → receive reference → check `/donation/:ref` → see it on goods ledger.
5. **Organization from zero to verified**: sign in → register org → pending screen with what happens next → verified by moderator (or vouched by another org) → create center → record intake → publish needs list → handle a transfer to another center.
6. **Moderator shift on mobile**: sign in → guidelines acknowledgement gate → district scope badge → queue → call the registrant → publish or reject with preset reason → match → print ward claim sheet → redeem codes → audit entry visible publicly.
7. **Admin onboarding a moderator**: look up user by email → set role and districts → confirm → audit entry.
8. **Reader checking accountability**: Audit → month filter → masked entries; Ledger → district and ward → CSV export.
9. **Language switch mid-task** on every one of the above, without losing form state.
10. **Offline**: previously visited board opens from cache with a visible "cached" notice; submit is disabled with an explanation.

## 11. Accessibility and inclusive design requirements

- WCAG 2.2 AA minimum. Known current failures to fix: muted-on-rule 4.15:1, red-on-rule 3.89:1, hairlines 1.28:1, disabled 3.69:1, blue/30 underline 1.78:1.
- Visible focus on every interactive element, including on dark buttons.
- Semantic headings: one h1 per page, no level skips (currently skipped on five routes, none on Desk).
- All form fields labelled (four selects and one input currently unlabelled).
- Live regions for search results, loading and action results; do not re-announce per keystroke.
- Dialogs: native dialog semantics, focus trap, Esc closes, backdrop dims.
- Reduced motion respected. No content that depends on color alone.
- Text scale to 150% and high-contrast are user-visible settings; test every screen in both.
- Nepali default consideration for `ne-*` browsers is an open owner decision; design must work either way.

## 12. Content and tone

- Plain language, short sentences, verbs first. Define the nouns the site invents on first use: need, offer, claim code, ref code, update code, dispatch, drop center, ledger, audit.
- "What happens next" blocks after every submission (already liked by users; keep and make consistent).
- Never imply the site can rescue, search physically, or handle money.
- Errors say what went wrong and what to do, in the user's language. Never "Failed to fetch".
- Numbers use the language's numerals. Dates show relative and absolute forms where space allows.

## 13. Known problems the redesign should solve

From the 2026-09-01 review and later testing, still open:

- Two visual systems (editorial public pages vs stock shadcn portal/Desk); three status idioms; red overloaded.
- Nine-item primary nav; Dispatches (essays) sit beside missing-persons search during a live emergency.
- Desk queue lacks filters, bulk actions, keyboard shortcuts; needs a way to edit a need's text before publishing (guidelines require removing phone numbers from descriptions).
- Chat launcher collides with page controls on mobile.
- Three different bearer codes (ref, claim, update) with no visual distinction.
- Long forms need progress, section grouping and inline validation designed, not just implemented.
- Print layouts are unstyled.
- Empty, loading, error and offline states are inconsistent across pages.
- The donor "I dropped something here" dialog on the drop-center page is not rendered, so the printed QR flow dead-ends (see §8.4). Design it as if it works; engineering will wire it.
- Raw machine values (statuses, entry types, action codes, months) appear in several lists.

## 14. Deliverables expected from the designer

1. **Discovery notes**: questions answered (see §15), persona confirmations, any interviews with a moderator and a registrar.
2. **Information architecture**: site map, navigation model for public vs signed-in surfaces, URL list unchanged unless justified.
3. **User flows** for the ten flows in §10, with every state (loading, empty, error, offline, unauthenticated, wrong role, success).
4. **Design tokens**: color (including status and emergency scales in normal and high-contrast), type scale that works for Latin and Devanagari at 100 to 150%, spacing, radius, elevation, motion. Deliver as a tokens table the engineers can map to CSS variables.
5. **Component library** in Figma covering: buttons, links, inputs (text, textarea, select, phone, ward picker, photo upload, checkbox, consent), status marks and badges, tables (ruled data tables, sortable lists), cards, list rows, filters and tabs, dialogs and confirm sheets, toasts and inline alerts, empty states, skeletons, pagination and "load more", code display (ref/claim/update), print sheet, map plate and legend, chat launcher and panel, masthead, nav, footer, accessibility bar, sign-in gate, scope badge.
6. **Screens** for every page in §§5 to 9, at 320, 390, 768 and 1280 px, in English and Nepali, in normal and high-contrast, plus print for ledger, claim sheet and center needs list.
7. **Prototype** of flows 1, 4 and 6.
8. **Handoff**: annotated specs, redlines, copy deck (both languages, keyed to existing string names where possible), and an accessibility annotation layer (headings, landmarks, focus order, live regions).
9. **Acceptance criteria** per screen that engineering can test against.

## 15. Open questions for kickoff

1. Should Nepali be the default language for Nepali-locale browsers?
2. Do Dispatches stay in the primary nav, or move under a "Community" or "Stories" section?
3. Is the newsprint direction kept, evolved, or replaced? Owner previously rejected "AI-looking" card-and-gradient styles.
4. Does the Desk become a separate app shell (sidebar, dense tables) or stay within the public shell?
5. What is the target for the map: keep satellite imagery or move to a lighter vector base?
6. Priority of Projects (committee projects with photo updates) versus Drop centers going forward; both exist today.
7. Any brand refresh planned (logo, wordmark)?

## 16. How to see the current product

- Production: https://verifiednepal.com (public pages, sign-in requires a Google account; moderator access by invitation).
- Dev: automatically deployed from `main`; ask the owner for the URL and a moderator test account.
- Local: `pnpm install && pnpm dev` at http://localhost:8765 renders the public site from the bundled snapshot with no backend.
- Guides with screenshots: `public/guides/*.pdf`.
