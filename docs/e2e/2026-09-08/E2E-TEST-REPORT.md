# E2E test report, 8 September 2026: overnight slices

Target: `https://dev.verifiednepal.com` and `https://api.dev.verifiednepal.com`, build `750988d`.
Nothing on production was touched.

Scope: the slices shipped overnight after the 7 September ward register: offline outbox with
submission idempotency, SMS adapter (inactive), standard kit catalogue, one-door distribution
filing with the DDMC daily log, drone tasking board, staff assignments and shift handover, and
requests in kit units. Plan: infra repo `docs/2026-09-08-overnight-slices-plan.md`.

Accounts: `helper-04-beta-tester` (owner of Koshi Boat Volunteers, verified), `admin-beta-tester`
(moderator actions), `helper-beta-tester` (on-behalf registration). Incident:
`seed-melamchi-landslide-cluster`.

## API level (25 checks, scripted)

| # | Check | Result |
|---|---|---|
| K1 | `GET /kits` lists 6 kits with weights | pass |
| D1 | Organization files a distribution; the family-kit line expands to category lines | pass |
| D2 | Ward outside the palika rejected | pass |
| D3 | Moderator sees the planned distribution | pass |
| D4 | Moderator acknowledges on behalf of the district office | pass |
| D5 | Public list shows it without the contact phone | pass |
| D6 | Organization completes with households reached | pass |
| D7 | DDMC log CSV has the HXL row and one row per ward, no phone | pass |
| R1 | Organization registers a drone operator | pass |
| R2 | Organization registers a landing site | pass |
| R3 | Moderator posts a payload request; weight computed from the kit (4 × 6 kg) | pass |
| R4 | Organization assigns its own operator | pass |
| R5 | Mission planned with permit and NOTAM references | pass |
| R6 | Mission marked flown | pass |
| R7 | Moderator confirms delivery | pass |
| R8 | Public board: no phones or contact names, landing site keeps coordinates, flight listed | pass after fix (see Finding 1) |
| A1 | Owner creates an assignment | pass |
| A2 | Status moves forward (on site) | pass |
| A3 | Status cannot move backward | pass |
| A4 | Activity log entry | pass |
| A5 | Handover sheet groups assignments and includes the day's log | pass |
| A6 | Handover CSV | pass |
| O1 | On-behalf need with a kit and a `submissionId` created | pass |
| O2 | Same `submissionId` replays the first need with `x-idempotent-replay: 1` | pass |
| O3 | Status page shows the kit | pass |

## Browser level (headless Chrome over CDP, signed in as the organization owner)

| Check | Result | Screenshot |
|---|---|---|
| Public `/drones` board lists the operator, the landing site with a map link, and the day's flight | pass | `screenshots/01-drones-board.png` |
| Organization Distributions tab shows the filed, acknowledged and completed distribution | pass | `screenshots/02-org-distributions.png` |
| Organization Drones tab shows operators, sites and missions | pass | `screenshots/03-org-drones.png` |
| Organization Team work tab shows the assignment and log line | pass | `screenshots/04-org-team-work.png` |
| Coverage page has the DDMC daily log download | pass | `screenshots/05-coverage-ddmc.png` |

## Findings

**1. Confirmed missions vanished from the public flight timeline.** The board listed only planned
and flown missions, so a delivery confirmed by a moderator dropped off the day's timeline. Fixed
the same night (`4e7e5ca`): only aborted missions are hidden. Re-verified on dev.

**2. Codex removed public landing-site coordinates twice**, reading the privacy rule for delivery
receipts as applying to infrastructure. Restored both times; the rule text given to Codex now says
landing-site coordinates are public.

**3. Members list is owner-only**, so a staff member opening Team work can only assign to
themselves. The existing `/orgs/:id/members` gate was kept; widening it to staff is a one-line
decision for the owner.

## Not covered

- Receipt photo upload and drone drop photo on dev (media secret still missing, see the 7 September report).
- SMS sending (no Sparrow token configured; adapter verified by unit tests only).
- Outbox flush in a real offline browser (unit-tested with a fake fetch; the badge and queued success state were type-checked and built).
