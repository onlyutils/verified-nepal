# TODO

## Organizations fulfilling a person's need — done 2026-09-04
A member of a verified organization can take a published need from the Give help board
(`POST /orgs/:id/needs/:needId/claim`), see the beneficiary's contact in the org dashboard's
Needs tab, then mark it delivered (`/deliver`, which writes the public ledger under the org's
name) or hand it back (`/release`). `fulfilNeed` in `server/src/models/claim.js` is the single
place a need becomes fulfilled, shared with the moderator claim-code redeem. An org that has
delivered a need counts as "org" for stories.

Open: no notification to the beneficiary when an org takes their request; they see it on the
status page ("Being handled by …") only when they check.

## Multi-disaster generalization — done 2026-09-05
`incidentId` threads through need/offer/project (`server/src/models/incident.js`,
`incidentController.js`), the public need form can pick an active/pending disaster or report a
new one inline, and admins manage the `/admin/incidents` queue (list/publish/approve/
reject/archive) from a Desk tab next to Admin (`src/desk/incidents.tsx`). Incidents reported
inline on a need form aren't actionable there by design — they activate automatically when a
moderator publishes that need.
