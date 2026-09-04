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
