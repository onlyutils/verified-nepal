> TODO: Nepali translation — this document is English-only for now; a Nepali version (नेपाली अनुवाद) is planned.

# VerifiedNepal — Governance

How the portal is run, who can do what, and how the community keeps it honest.

## Principles

- **Verified is the product.** Nothing user-submitted is published until a human moderator approves it.
- **No money touches the platform.** Funds go directly from donor to local committee. VerifiedNepal only verifies and documents.
- **Minimal public PII.** Masked names, district/ward-level location only, auto-expiry. See Moderation Guidelines for masking rules.
- **Paper is an interface.** Ward lists, claim tokens and the public ledger must print cleanly.
- **Every moderator action is public.** The [audit log](/audit) lists who published, rejected, matched or redeemed what, when, and why.

## Roles

| Role | How you get it | What you can do |
|------|----------------|-----------------|
| Helper | Sign in with Google | Offer help, use claim codes |
| Moderator | Invitation by an admin (see below) | Publish/reject needs, offers, projects, dispatches; redeem and sync claims; act only inside assigned districts if scoped |
| Admin | Granted by another admin in DynamoDB | Everything a moderator can do, plus manage roles and district scope, view stats and the audit log |

Helpers and moderators sign in with Google. Helpers are self-serve; moderation is invite-only — there is no application form.

## How to become a moderator

There is no public application.

1. **Be a trusted registrar first.** You register neighbours who cannot register themselves (often many times from one phone). After several approved on-behalf registrations, moderators see a "known registrant — N approved" badge on your submissions. You are not scored — you are noticed.
2. **Invitation by an admin.** An admin invites an existing Google account that is already known on the ground — typically a teacher, health worker, youth-club lead or other person the community vouches for. Diversity across wards and backgrounds is intentional so the on-behalf network does not replicate local elite capture.
3. **Read the guidelines, acknowledge, start in district scope.** On first sign-in you must read `docs/MODERATION-GUIDELINES.md` and acknowledge it. If you are district-scoped you only see and act on items in those districts. Your first actions are informally reviewed by an admin.

If you think you should be a moderator, the path is to keep helping people register accurately — moderators will find you.

## District scoping

Moderators may be assigned to specific districts (for example `["Rasuwa"]`). A scoped moderator:

- only sees the queue, boards, print sheets and claim views for those districts,
- gets a visible scope badge in the Desk,
- receives `403 out_of_scope` if they try to act outside their districts.

Dispatches are not district-scoped. An empty district list means "all districts".

## Moderation guidelines

Summarised here, detailed in `docs/MODERATION-GUIDELINES.md`:

- Verify before you publish — call the registrant and, when needed, the ward.
- Mask correctly; never share private details publicly or by side-channel.
- Never moderate your own ward's own relatives; declare the conflict and let another moderator handle it.
- Handle claim lists carefully — printed codes are bearer tokens on paper.
- Every action is written to the audit log with your name.

Moderators must acknowledge the guidelines before any moderation endpoint will accept their actions. Admins are exempt from the gate.

## Escalation

- **Inside the Desk:** if you are unsure, leave the item in the queue and flag it for another moderator or an admin. Do not publish "to be helpful".
- **Disagreement about a decision:** raise it with an admin; the audit log entry stays, and any correction is a new audited action.
- **Concerns about a moderator:** contact an admin. The audit log is public so the community can see patterns, and admins can revoke or narrow the role and scope.
- **Legal or safety emergency:** follow local law and emergency contacts first, then record what you did.

## Data removal

- Any person can ask for their data to be corrected or removed: contact via the address on the [Info / Help](/info) page or tell any moderator/admin in person.
- Moderators forward the request to an admin; the admin removes or masks the record from the live boards and flags it for expiry. The audit log records `data_removal` with a masked target label — private fields are never written to the audit.
- Ledger entries for redeemed aid stay as masked, district/ward-level rows — they are the social-audit record. Household composition and contact details are never public, there or elsewhere.
- Removal is handled promptly; if it cannot be completed the same day, the requester is told why and when to expect it.

## No-money principle

VerifiedNepal never holds, routes or takes a commission on funds. Project pages show verified committee bank/eSewa/Khalti details so donors can use their remittance app directly. If anyone asks you to send money "through the portal" or "to a moderator", it is fraudulent — publish that as a rejection reason and escalate.

## Audit and accountability

Every publish, reject, role change, match, redeem and sync writes an `AUDIT` item `{actor, action, targetType, targetLabel, reason?, ts}`. The public page at `/audit` is the accountability counterpart to the moderation queue — the community can see that moderators are accountable too. `targetLabel` is always masked.

## Changing this document

Changes are proposed as a pull request in the public repo, reviewed by at least one admin and one moderator, and recorded in the audit log as `governance.change`.

