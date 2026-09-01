# VerifiedNepal — Moderation Guidelines

Read this before you moderate anything. You must acknowledge it in the Desk before the moderation endpoints will accept your actions.

## 1. Verify before you publish

- **Call the registrant** on the phone number in the private details. Confirm the beneficiary's name, ward, and what is actually needed. If they cannot be reached after two attempts on different days, keep the item in the queue and try again — do not publish on guesswork.
- **Call the ward / local contact** when the need is about shelter, displacement or a household the registrant does not live in. The ward secretary is the verification backstop; ask them to confirm the household exists in that ward.
- **Check the duplicate panel.** Same beneficiary name + same ward with another open need is usually a duplicate submission from a second registrar — compare the details and keep one, reject the other with a clear reason.
- **Photos and descriptions:** publish only what you have verified. If a description seems copied or generic, ask the registrant to clarify.

## 2. Call the registrant — every time

The phone call is not optional. It is the only check that the need is real and consented to. Explain who you are, why you are calling, and that the public listing will be masked. If the beneficiary did not consent, reject with `not_consented` and explain why.

## 3. Masking rules (what the public sees vs. what you see)

Public boards, project pages, the ledger and the audit log show **only**:

- Masked name: first initial + surname or given name, never a full name.
- District and ward. Never a tole, street address, or GPS pin.
- Category and short description (you edit out phone numbers, citizenship numbers, and household composition before publishing).
- For the ledger: `maskedName + category + ward + redeemedAt` only.

**Never public, not even in the audit `targetLabel`:** phone numbers, full names, household size or composition (especially woman-headed or child-only households), registrant name/phone, bank details beyond what a verified committee explicitly asked to publish. If you are unsure whether something is masking-safe, leave it out.

## 4. When to reject

Reject with a short, humane reason that becomes the SMS/phone explanation to the registrant. Common reasons:

- `duplicate` — already listed under a similar name/ward.
- `not_consented` — beneficiary did not consent or was not reachable.
- `already_received` — the household already received aid for this need.
- `not_a_real_need` / `not_verifiable` — you called and could not verify, or the claim is inconsistent.
- `sensitive_details` — the submission contains sensitive PII that cannot be safely masked.
- `conflict_of_interest` — you must not moderate your own ward's relatives (see below).

Rejection is not a punishment. Write the reason as you would say it on the phone.

## 5. Never share private details

- Do not copy private fields into public notes, audit reasons, WhatsApp groups, or paper printouts beyond the minimal claim sheet.
- Claim sheets (printed `claimCode + maskedName + ward + category`) are bearer tokens. Keep printed sheets face-down in transit; leave the QR/code column blank when you photocopy for public noticeboards.
- If a recipient is a woman living alone, a child, or otherwise at risk, be extra conservative — the safety risk of publishing household composition is never worth the extra context.

## 6. Claim-list handling

- Print per-ward sheets from the Desk: `Print claim list → district → ward → Print this sheet`.
- At the distribution site, tick off on paper. Claim codes are redeemed once — a second redemption visibly bounces as `already_redeemed`.
- If you are offline, collect codes on paper and use `Paper sync` afterwards. Duplicates are reported at sync time; re-tick the physical list.
- Never read a claim code aloud in a public place.

## 7. Conflicts of interest

**A moderator never moderates their own ward's own relatives.**

If the beneficiary is a relative, neighbour whose household you are close to, or anyone where your objectivity could reasonably be questioned — declare the conflict, leave the card in the queue, and let another moderator (or an admin) handle it. This is audited; favouritism destroys trust.

The same applies to offers and projects where you are on the committee or stand to benefit.

## 8. Audit accountability

Every publish, reject, match, fulfill, redeem, sync, role change and governance change writes an `AUDIT` item `{actorSub, actorName, action, targetType, targetId, targetLabel, reason?, ts}`.

- The audit page at `/audit` is public. Your name is on every action you take.
- `targetLabel` is masked (`need → maskedName + ward`, `project → title`, `dispatch → title`, `user → masked email like r***@domain`). Never write private fields into `targetLabel` or `reason`.
- Audit months are keyed `AUDIT#YYYY-MM`, newest first, cursor-paginated and cacheable.

Assume the community will read the audit. Moderate as if you are on the public record — because you are.

## 9. Useful scripts

- Opening line on a call: "Namaste, I am [name] from VerifiedNepal. You registered a need for [beneficiary initial] in Ward [n] — can I confirm a few details so we can publish it safely?"
- If you must reject: give the reason in one sentence and offer the path back: "We could not verify / we found a duplicate — here is what to do next …"

## 10. Escalation

If you are unsure, **do not publish**. Leave the item pending, add a note in the flag/reason field, or contact an admin. A slow queue is better than a wrong publish. Admins can be reached via the contact on the Info page and are responsible for reviewing early actions from new moderators.

---

By acknowledging these guidelines in the Desk, you agree to follow them. Violations are handled by admins: narrowing district scope, suspending the role, and recording the correction in the audit log.
