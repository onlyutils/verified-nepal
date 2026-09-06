# Admin-role e2e findings (dev.verifiednepal.com, 2026-09-06)

Account admin-beta-tester@verifiednepal.com. Headless Chrome via CDP (1280×900, 390×844) + curl. Fixtures tagged E2E-0906-admin. 29 screenshots in this folder.

## 1. Flows tested

| # | Flow | URL / endpoint | Expected | Actual | Result | Shot |
|---|---|---|---|---|---|---|
| 1 | Admin sign-in via test form | /desk/login → /desk | Lands on Desk, no guidelines gate | As expected | PASS | 02 |
| 2 | Admin endpoints reject others | GET/POST /admin/* | 403 helper/moderator, 401 anon | All 403 / 401 | PASS | — |
| 3 | Admin tab stats + moderator table | Desk → Admin | Stats cards + list | 6 stat cards, 3 moderators | PASS (B5) | 03 |
| 4 | Lookup user by email | Admin → Lookup | sub, role, ack, role select, districts | All shown | PASS | 04 |
| 5 | Existing districts pre-checked | Lookup moderator-beta-tester | Kathmandu + Kaski checked | [Kaski, Kathmandu] | PASS | — |
| 6 | Promote throwaway → moderator via UI | Save role → confirm → Save | Confirm dialog; /me reflects | Dialog "Confirm role change … This will be audited." → "Role updated." → /me moderator | PASS (B3, B6) | 05/06/07 |
| 7 | Demote throwaway → helper (API) | POST …/role {helper, []} | 200; moderation 403 | 200; GET /moderation/queue 403 | PASS | — |
| 8 | Admin self-demotion | POST …/self/role {helper} | 403 | 403 self_demotion_not_allowed | PASS | — |
| 9 | Role validation | role=superuser / unknown sub / unknown email | 400 / 404 / 404 | 400 / 404 / 404 | PASS | — |
| 10 | District validation on role endpoint | districts=["Atlantis"] | 400 | 200, stored, shown in table | FAIL (B3) | 03 |
| 11 | Report disaster (helper token) | POST /incidents/request ×2 | 201 pending | 201 pending | PASS | — |
| 12 | Report validation | no photo; anonymous | 400; 401 | 400 "media must include at least one photo"; 401 | PASS | — |
| 13 | Pending hidden from public page | GET /incidents; /incidents | Not listed | Not listed | PASS | 01 |
| 14 | Pending exposed via public status filter | GET /incidents?status=pending (anon) | Not listed / no internal fields | Listed with createdBy and proofMedia | FAIL (B1) | — |
| 15 | Admin creates draft | POST /admin/incidents | 201 draft | 201 draft | PASS | — |
| 16 | Disasters tab — Pending | Desk → Disasters | Cards with Edit/Approve/Reject | As expected | PASS | 09 |
| 17 | Edit dialog | Edit → rename → Save | "Updated"; audit edit | As expected | PASS | 10 |
| 18 | Approve Landslide A (UI) | Approve | Active, public, audit | One click, no confirm; public page shows it | PASS (B4) | 11, 25 |
| 19 | Reject without reason | Reject → Reject | Blocked | "Enter a reason to reject." | PASS | 12 |
| 20 | Reject Flood B with reason | Reject | Rejected; invisible publicly | Absent for anon/helper/moderator; ?status=rejected public → 400 | PASS | 13, 29 |
| 21 | Tabs Active/Draft/Archived/Rejected | mouse-click | Each loads | Each fetched /admin/incidents?status=… | PASS (E2) | 27/28/29 |
| 22 | Publish C, archive A (API), archive C (UI); invalid transitions | POST …/publish, …/archive | Succeed; repeats 400 | All as expected; UI Archive one click | PASS (B4) | 27 |
| 23 | Public list reflects states | GET /incidents, ?status=archived | active listed; archived only under archived; rejected never | As expected | PASS | 25 |
| 24 | Admin can moderate | Desk → Queue | Items with Claim | 3 pending offers, Claim buttons | PASS (spot-check) | 22 |
| 25 | Climate admin vs public | Desk → Climate; /climate | Consistent | 31 msgs / 6 downloads; public renders | PASS | 21, 24 |
| 26 | Audit masking | GET /audit?month=2026-09; /audit | Emails masked | t***@verifiednepal.com; actor names shown | PASS (B2) | 23 |
| 27 | Mobile Admin + Disasters | 390×844 | No horizontal scroll | scrollWidth 390 | PASS | 08, 26 |

## 2. Bugs

- B1 P1 — Public GET /incidents?status=pending leaks unapproved reports and the reporter's user id. PUBLIC_INCIDENT_STATUSES includes pending; stripInternal only removes PK/SK/GSI keys, so anonymous callers get pending incidents with createdBy (OnlyUtils sub), proofMedia URLs, and approvedBy on active ones. The page filters client-side; the API doesn't. Repro: curl 'https://api.dev.verifiednepal.com/incidents?status=pending'. Fix: drop pending from public statuses (frontend listIncidents() defaults to active,pending — check dependents) and strip createdBy/approvedBy/rejectionReason in handleGetIncidents.
- B2 P2 — Public audit page mislabels targets and actions: every Target reads "User · …" (incidents, orgs too); approve/edit/role.set/org.create all render "Updated" — an approval is indistinguishable from an edit. Shot 23.
- B3 P2 — POST /admin/users/:sub/role accepts arbitrary district strings ("Atlantis" stored, displayed, un-removable from the checkbox UI). A moderator scoped to a bogus district sees nothing.
- B4 P2 (safeguard) — Approve and Archive are single-click with no confirmation; Archive is irreversible. Role change has a confirm; these don't.
- B5 UX-nit — Stats labels: "Oldest pending age: h" (dangling unit); every label ends with a colon.
- B6 UX-nit — "Role updated." shown twice (banner + inline). Shot 07.
- B7 UX-nit — Broken proof image has no fallback. Shot 09.

## 3. UX observations

- Desk sections are buttons, not routes: /desk?section=admin and /desk/admin land on Queue; reload loses the section; nothing linkable.
- Role-change confirm dialog is a good pattern (restates email/role/districts, "will be audited") — reuse for Approve/Archive.
- District picker: 77 checkboxes, two columns, no search; Rasuwa/Nuwakot/Sindhupalchok pinned to top with no explanation. The moderator's own district page has search — reuse it.
- Lookup panel shows "User ID: ou_user_…" prominently — support-only noise.
- Stats: "Is moderation keeping up?" framing is good; cards don't say which "pending" (incidents aren't counted).
- Edit dialog's "Affected districts (comma-separated)" is free text on a form that uses checkboxes elsewhere.
- Rejection reason is public on /audit though the placeholder says "shown to the reporter".
- Audit page: no filter by action/target type; no link from a row to the item.
- Mobile: sidebar becomes a horizontal strip with last items cut off ("Print cla…"), not obviously scrollable; Moderators table clips the Name column.
- Queue district filter shows "NawalparasiWest"/"RukumEast" without spaces.

## 4. Test data and final states

- throwaway-beta-tester@verifiednepal.com / E2eTest!2026Pass (ou_user_34K2XurjnM0osiKm4d8Vr): in test audience (ou_aud_34K2XfynR7tGzZG7j6sjn) + fixture; DynamoDB role helper, districts []. No MCP delete-user tool.
- Incident e2e-0906-admin-landslide-a: archived (pending → edit → approve → archive).
- Incident e2e-0906-admin-flood-b: rejected (reason recorded).
- Incident e2e-0906-admin-admin-draft-c: archived (draft → publish → archive).
- Audit rows for all of the above, September 2026.

## 5. Environment limitations

- E1 Turnstile not exercised here (/incidents/request is auth-only); reports created via API with fabricated proofMedia (hence broken-image cards). Browser "Report a local incident" form not driven.
- E2 Radix tab triggers ignore synthetic element.click(); real CDP mouse events needed. Not a product bug.
- E3 Queue approval as admin only spot-checked to avoid racing the moderator run.
- E4 15-minute tokens; each browser run re-logged in.
