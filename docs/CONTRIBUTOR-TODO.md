# Contributor TODO — open design decisions

These are real, unsolved design questions in VerifiedNepal. There is **no code for them yet** — they are good deep first contributions. Each one is written from scratch, so you do not need prior context to pick it up.

Before writing code for either of these, **open an issue with your proposed approach first.** Both touch privacy and people's names, so the design discussion matters as much as the code. See [GOVERNANCE.md](GOVERNANCE.md) and the [Privacy page](../src/privacy.tsx) for the rules these must respect.

---

## 1. Beneficiary deduplication identity

### The problem, plainly
A "need" is a request for help tied to one person (the beneficiary). After a disaster, the *same person* often ends up registered more than once:

- they register themselves, and a neighbour also registers them;
- a **ward registrar** (a volunteer) registers many neighbours from a single phone, sometimes the same family twice;
- someone re-submits because they were not sure the first one went through.

If the system cannot tell that two records are the same person, aid gets **double-counted or double-distributed**, and moderators waste time reviewing duplicates. We need a way to recognise "these two records are probably the same human."

### Why it is hard here
By design, VerifiedNepal collects **as little personal data as possible**: masked names and district/ward-level location only. We deliberately do **not** store citizenship numbers, full addresses, or dates of birth. That is good for privacy — but it means we do not have a strong unique key to match people on.

### What exists today
The moderator queue shows a weak "possible duplicates" hint: it flags records with the **same beneficiary name + same ward**. That is the whole mechanism. There is no canonical per-person identity. The code is `server/src/models/moderation.js` (function `enrichWithDupCandidates`), surfaced in the Desk queue UI.

### Options to weigh (with trade-offs)
1. **Fuzzy match on name + ward** (optionally age or household size). Easy and privacy-friendly, but misses spelling variants (see the romanized-Nepali item below) and produces false matches for common names.
2. **A few digits of the citizenship number, stored hashed** (never the raw number). Much stronger matching, but asks for sensitive data many people will not have on hand in an emergency, and raises consent questions.
3. **Phone number as identity.** Unreliable: people share phones, change SIMs, or have none.

### What a good contribution looks like
1. Propose the identity model in an issue (privacy implications first).
2. Add a **name-normalization function** (fold Devanagari/romanized forms, strip honorifics/nicknames) — this overlaps with item 2, so coordinate.
3. Add a **match-scoring function** with unit tests (real-world name pairs, including near-duplicates and true distinct people).
4. Surface ranked candidates to the moderator in the Desk queue — **assist a human, never auto-merge.**

### Hard constraints
- Never store raw citizenship numbers. Any new identifier must be **hashed**, never reversible.
- Public views stay masked.
- The governance rule "verify before you publish" still holds — deduplication is a hint for a moderator, not an automatic action.

---

## 2. Romanized Nepali storage

### The problem, plainly
Nepali names and places can be typed two ways:

- in **Devanagari** script: `राम`, `रसुवा`
- in **romanized Latin** script: `Ram` / `Raam`, `Rasuwa`

The same person or place gets entered in either script by different people. This breaks three things: **search** (a relative searching for a missing person), **deduplication** (item 1 above), and **consistent lists**.

### Why it matters
During an emergency, a relative looking for a missing family member may type the name in whichever script comes naturally. If the stored record is in Devanagari but they search in romanized Latin (or vice versa), they get **no result** — at the worst possible moment.

### What exists today
Names are stored **exactly as typed**. The find-a-person search (`src/find-person.tsx`) already does diacritic-folding and order-independent matching, but it does **not** transliterate between scripts. So a Devanagari record will not match a romanized query, and the reverse.

### Options to weigh (with trade-offs)
1. **Store as typed, plus a hidden normalized key.** Keep the original name untouched for display, and generate a canonical romanization alongside it used *only* for search and dedup, never shown. Best user experience. The hard part: Nepali romanization is non-trivial — there are multiple schemes, and issues like schwa deletion (the silent inherent vowel).
2. **Transliterate on display to one script.** Do not do this lightly: a name is a person's identity, and auto-rewriting it will mangle names people care about.
3. **Do nothing (status quo).** Simplest, but cross-script search keeps failing.

### Recommended direction
Option 1 — keep the original display name exactly as typed, and add a derived, hidden, normalized key for matching.

### What a good contribution looks like
1. Propose the romanization scheme in an issue, citing a documented standard for Nepali.
2. Add a **transliteration/normalization helper** with a strong test table of real bilingual name pairs.
3. Wire it into the search index (`src/find-person.tsx`) and into the dedup normalization from item 1 (share one helper).

### Hard constraints
- Never alter the stored **display** name — the normalized key is derived, hidden, and used only for matching.
- Must handle both scripts and common nickname forms.
- Ship it with tests using real Devanagari/romanized name pairs.

---

## Non-goal: automated need↔offer matching

Matching a need to an offer (moderator "Match" action) and an org claiming a need are both deliberately manual — a person picks from a list, no scoring. This is documented in [FEATURES.md](FEATURES.md) and [DESIGN-BRIEF.md](DESIGN-BRIEF.md) as intentional, not a gap.

**Do not build an automated matching/scoring engine for this.** So for a trust/safety-sensitive mutual-aid platform, keeping matching human isn't a gap to fix — building a scoring/geo-matching engine here would be solving a problem you explicitly decided not to have. Skip it. If you think automated matching is worth reconsidering, open an issue proposing it first — this is a deliberate design stance, not an oversight.

---

*SMS intake (a phone/shortcode gateway for people who cannot use the web) is also on the roadmap but is deferred for now — do not start it without checking with the maintainer.*
