# Beta Testing — Dev Environment

Dev only: `https://dev.verifiednepal.com`. **None of this exists on production** —
prod has no test-user population and no test-audience allow-list gate.

The product's USP is principle #1 from the project plan: **"Verified is the
product."** Nothing a member of the public submits (a need, an offer, a missing
person poster, a project, an article, a story, an org delivery) becomes publicly
visible until a signed-in **moderator** approves it at `/desk`. Everything below
exists to let you exercise that pipeline end to end, for all three roles.

## Dev test accounts (dev only)

| Role      | Email                                     | Password           |
|-----------|---------------------------------------------|---------------------|
| helper    | `helper-beta-tester@verifiednepal.com`     | `E2eTest!2026Pass`  |
| moderator | `moderator-beta-tester@verifiednepal.com`  | `E2eTest!2026Pass`  |
| admin     | `admin-beta-tester@verifiednepal.com`      | `E2eTest!2026Pass`  |

Plus 25 more helper accounts for parallel testers — `helper-01-beta-tester@verifiednepal.com`
through `helper-25-beta-tester@verifiednepal.com`, all with the same password. They own the
dev dataset's needs/offers/orgs/projects/articles/posters described in
[e2e/2026-09-06/DEV-DATASET.md](e2e/2026-09-06/DEV-DATASET.md) (which helper owns what is in
`dev-dataset.json` next to it). The 2026-09-06 e2e test report and user-flow document for
UI/UX review live in [e2e/2026-09-06/](e2e/2026-09-06/).

These are OnlyUtils fixture accounts (`provider: password`) on the dev client
(`ou_client_34HIKupJ5afWl0DIoh7zi`), with roles already present in DynamoDB so each
account lands in its role from the very first request — no promotion step
needed. Verified working 2026-09-06 (all three return the expected role from
`/me`). They use the `@verifiednepal.com` domain purely as a label — these are
OnlyUtils password accounts, not real mailboxes; nothing is ever emailed to
them.

### Signing in through the real UI (human testers)

`/desk/login` on dev has a second, dev-only sign-in form below the Google
button: **"Test account sign-in (dev only)"**. It's gated by the
`VITE_ENABLE_TEST_LOGIN` build flag, on for dev, never set for prod — the
Google button is still the only option on production. Enter one of the three
emails above with the password and you're in, exactly like any other signed-in
user — no Gmail account, no allow-list, no promotion step. Confirmed
end-to-end 2026-09-06 (headless-browser run): submitting the moderator
credentials lands on `/desk` and immediately shows the moderator guidelines
gate, proving the role resolves correctly through the real app, not just the
API.

The form works by calling OnlyUtils' `POST /login` (email+password+client_id,
no client secret needed) directly from the browser and storing the returned
tokens the same way the Google flow does — see `src/lib/auth.tsx`
(`signInWithPassword`) and `src/desk/login.tsx`.

### API/agent-level testing

The same fixture accounts also work without a browser, for scripting or an
agent driving the API directly:

```bash
# Get a token
curl -s -X POST https://auth.onlyutils.com/login \
  -H "Content-Type: application/json" \
  -d '{"email":"moderator-beta-tester@verifiednepal.com","password":"E2eTest!2026Pass","client_id":"ou_client_34HIKupJ5afWl0DIoh7zi"}'
# -> {"access_token":"...", "refresh_token":"...", "expires_in":900, ...}

# Call the API with it
curl -s https://b7pru6scda.execute-api.ap-south-1.amazonaws.com/me \
  -H "Authorization: Bearer <access_token>"
```

(The real Gmail accounts — `onlyutils@gmail.com` as admin,
`laxman.pokhrel.101@gmail.com` as moderator — still exist and still work the
old way; the dev dataset accounts above are the recommended path for anyone new.)

## What to test — the USP checklist

The common shape for every content type below: **submit → invisible to the
public → moderator sees it in the queue → approve/reject → visible (or not) on
the public page → action recorded in `/audit`.** That loop not holding for any
type is a USP-breaking bug.

### As anyone (no account)
- [ ] Submit a help request (`/get-help`) — self-registration remains anonymous; on-behalf
      registration requires sign-in and consent; phone is required when on-behalf.
- [ ] Offer to help (`/give-help`) works signed out where the flow allows it.
- [ ] Report a missing person poster (`/poster`) — does **not** appear
      publicly until approved.
- [ ] Search a missing/rescued person by name (English and Devanagari).
- [ ] Anonymous forms show the Turnstile widget and reject submission without
      a valid token.
- [ ] Nothing you just submitted is visible on any public list yet.
- [ ] Every page above works in both English and Nepali.

### As helper (signed in)
- [ ] Offer to help, see your own submissions on `/me`.
- [ ] Split a large need into a group and claim a piece (helper groups).
- [ ] Read/write an article; post a story (photo/video + caption).
- [ ] Propose a community project.
- [ ] Register/run an organization; take a need and mark it delivered.

### As moderator (signed in, district-scoped)
- [ ] First sign-in is gated behind acknowledging the moderator guidelines —
      no queue actions work until you do.
- [ ] The Desk queue shows only items in your assigned district(s) (unless
      you have no district restriction).
- [ ] Approve a need/offer match, issue a claim code — code redeems correctly
      and shows on the masked public ledger.
- [ ] Approve/reject a missing-person poster, project, article, story,
      dispatch — each one's visibility flips correctly afterward.
- [ ] Verify a project committee, then publish it and its pending photo.
- [ ] Every one of the above actions appears in `/audit`, masked.

### As admin (signed in)
- [ ] Admin tab: look up a user by email, change role, set district scope.
- [ ] Disasters tab: approve, reject, or archive a reported disaster; needs
      and offers correctly scope to it afterward.
- [ ] Everything a moderator can do, admin can also do (no district
      restriction by default).

### Cross-cutting
- [ ] A rejected item never becomes visible, from any account or logged out.
- [ ] The audit log (`/audit`) never reveals a beneficiary's full name/PII —
      confirm masking.
- [ ] Media upload (photo/video) on a need, project, article, or story
      round-trips through presign → CDN and actually renders.
- [ ] Climate page and donation status pages load and match the Desk data.

Report anything broken as a GitHub issue against this repo, including the
role you tested as and whether it reproduces logged out too.
