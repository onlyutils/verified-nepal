# Local updates: decisions (updated 2026-10-14)

Owner decisions after three council rounds. Transcripts: `council-news-portal-2026-10-13.md`,
`council-news-portal-2026-10-13-round2.md`, `council-news-portal-2026-10-14-round3.md`.

## Settled by the owner

| # | Topic | Decision |
|---|-------|----------|
| 1 | Storage | `kind: news` on DISPATCH, reusing fields. Own public tab ("Local updates"), own Desk queue. |
| 2 | Scope | Locality pre-filled from the reporter's home locality. Radio buttons: Ward, Municipality, District, Province, Nepal. |
| 3 | Moderation | Pre-moderation, same pending -> published path as articles and stories. Own Desk queue. Details below. |
| 4 | Language | Each post shows in the language written, EN / ने chip, toggle changes chrome only. Moderators declare the language(s) they moderate at onboarding; the news queue filters by it. |
| 5 | Reporter role | `reporter` role with home localities (empty = national). Anyone signed in can apply; admin approves; many per locality; may post outside locality. Works with post-moderation given the scope ladder below. |
| 6 | Public naming | "Local updates" and "local correspondents". No "news portal", no "reporters" in public copy. See DoIB note below. |
| 7 | Points | None public. Private tally + public profile (byline, locality, published count). |
| 8 | Display | `/local/<municipality>` page, picker once (Nepali, English, old VDC names), tiers Ward -> Municipality -> District -> Nepal with empty tiers collapsing, "Now" strip of local updates on top. |
| 9 | Condolences | Deferred. Entry in `docs/TODO.md`. |
| 10 | AI writer | Deferred. Separate requirement spec to be written after local updates ship. |
| 11 | Ads | Two labelled slots (विज्ञापन / Sponsored), admin-only AD item (image, link, area, dates, note). |
| 12 | Ad manager role | Deferred until a locality has a weekly audience and a second person handles ads. |
| 13 | Rollout | All 753 local levels available from day one; only localities with published items are listed. |

## Moderation of local updates (owner decision 2026-10-14: pre-moderation)

Post-moderation (council round 3) was rejected by the owner. Local updates follow the same
pending -> published/rejected path as articles and stories. Kept from round 3 because it still
applies under pre-moderation:

- Own Desk queue ("Local updates"), rows show title, body, scope, locality and sources inline
  with one-click approve/reject. Desk rule card: "Reject if no source, no place, or no date."
- Queue filters by the moderator's declared languages (set at onboarding). Local items sort first.
- Reporter can never review their own post.
- Scope-based reviewer rule against friend-approves-friend: Ward/Municipality scope may be
  approved by a same-district moderator (audit entry records `localReview: true`); District scope
  needs a moderator outside the reporter's home district; Province/Nepal scope needs
  `moderator.national` (admins are national by default).
- Rate limit: 5 submissions per 24 hours per reporter.
- Rejection works as for articles today (never public, reporter notified with reason). Three
  rejections in 90 days flag the reporter on the admin list; admin may revoke the role.
- Published items can be flagged by the public through the existing FLAGGED queue.
- Reporter edit after publish returns the item to pending.

Dropped with post-moderation: "Not yet checked" labels, tier ladder, auto-hide on flags,
staleness rule, strikes/suspension machinery, amplifier gating on `reviewedAt`.

**Fields.** USER: `reporter.localities[]`, `reporter.nationalScope`, `moderator.languages[]`,
`moderator.national`. DISPATCH: `kind`, `lang`, `scope`, `locality`, `happenedAt`, `expiresAt`,
`sourceUrls[]`. Audit entry: `localReview`.

## Empty localities (owner decision 2026-10-14)

Only localities with at least one published item are listed anywhere (local-area index, home
"Your area" suggestions, sitemap). The picker still offers all 753 local levels; a chosen area
with nothing published collapses to the next tier (Municipality -> District -> Nepal) as decided
in round 1, so no page ever renders an empty heading.

## Build order

1. `kind: news` + validator + scope radios + `happenedAt`/`expiresAt` + `sourceUrls` + backfill
   `kind: article` + Desk "Local updates" queue with inline approve/reject + language chip and
   language filter.
2. Municipality + ward on DISPATCH + locality GSI + `/local/<municipality>` page + picker +
   "Now" strip + localities-with-data index.
3. Reporter role, apply flow, scope-based reviewer rule, rate limit, profile, private tally.
   Moderator onboarding: languages + national flag.
4. AD item + two slots.
5. Later: AI writer spec, condolences, ad-manager role.

## DoIB note (owner asked 2026-10-14)

Nepal's Department of Information and Broadcasting (DoIB) registers "online media" under the
Online Media Operation Directive 2073 (2016) and the amended Printing and Publication framework.
Registration needs company papers, PAN and domain registration, is renewed yearly, and brings the
outlet under Press Council complaint jurisdiction. In 2025 the function moved to District
Administration Offices and then back to DoIB under 2082 regulations.

Owner decision: VerifiedNepal itself registers as the online media outlet. Reporters are
contributors publishing under VerifiedNepal's registration, like staff of one outlet, not
separate media companies, so they need no registration of their own. Public naming stays "local
updates" / "local correspondents" for now; once registration is done, "news" and "reporter" become
safe to use publicly. Sources were law-firm summaries and news reports, not the official text;
confirm current fees, editor requirements and renewal dates with DoIB directly.
