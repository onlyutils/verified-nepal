# E2E test report, 7 September 2026: ward register slice

Target: `https://dev.verifiednepal.com` and `https://api.dev.verifiednepal.com`, build `a25ea08` plus
the docs commits that followed. Nothing on production was touched.

Scope: the "org adoption slice 1" shipped today (see the infra repo,
`docs/2026-09-07-org-foundation-register-design.md`): municipality on needs and centers, requester
events, six-day take expiry, delivery receipt, coverage page and 3W export.

Accounts used (dev fixtures from [BETA-TESTING.md](../../BETA-TESTING.md)): `helper-beta-tester`
(Saraswati Rai), `admin-beta-tester` (publishing), `helper-04-beta-tester` (owner of Koshi Boat
Volunteers, for the drop-center checks). Incident: `seed-melamchi-landslide-cluster` (Rasuwa).

## Results

### API level (22 checks, scripted)

| # | Check | Result | Note |
|---|---|---|---|
| E1 | Need without `municipalityId` rejected | pass | 400 `beneficiary.municipalityId must be an integer` |
| E2 | Municipality from another district rejected | pass | 400 `municipality is not in that district` |
| E3 | Ward beyond the palika's range rejected | pass | Gosaikunda has 6 wards; ward 7 → 400 |
| E4 | Need created with municipality (on-behalf, signed in) | pass | 201, reference code issued |
| E5 | Admin publishes the need | pass | |
| E6 | Public list carries `municipality` and `ward` | pass | `Gosaikunda`, ward 3 |
| E7a | Helper takes the need | pass | |
| E7b | Status page shows `taken` event with a masked label | pass | `Saraswati R.` |
| E8 | `/me/dashboard` handled need carries `handledAt` | pass | drives the six-day countdown |
| E9 | Receipt photo presign and upload | **fail** | see Finding 1 |
| E10 | Deliver with households and coordinates | pass | photo omitted because of E9 |
| E11 | Status shows `delivered` event, households, no coordinates | pass | coordinates stay private |
| E12 | Ledger CSV has `municipality`, `households`, `receipt` | pass | `…,Gosaikunda,3,yes` |
| E12b | Ledger JSON exposes households and receipt flag only | pass | no photo URL |
| E13 | Coverage row for Gosaikunda ward 3 shows the delivery | pass | `cache-control: public, max-age=300` |
| E14a | 3W CSV has HXL row, delivered need, no names or phones | pass | |
| E14b | 3W GeoJSON point near Gosaikunda ward 3 | pass | `application/geo+json` |
| E15 | Release writes a `released` event, need back to published | pass | events `taken, released` |
| E16a | Center without municipality rejected | pass | |
| E16b | Center ward out of range rejected | pass | |
| E16c | Center created with municipality | pass | "Dhunche Relief Store", Gosaikunda ward 1 |
| E16d | Public center view shows municipality | pass | |

Also verified earlier the same evening, by invoking the scheduled task directly: a 13-day-old
organization take was returned to the open pool with a `take_expired` audit entry by `system`, an
`expired` requester event, and the organization's pointer row removed. The hourly EventBridge rule is
enabled on dev.

### Browser level (headless Chrome over CDP)

| Check | Result | Screenshot |
|---|---|---|
| Get help: choosing Rasuwa lists its five palikas; choosing Gosaikunda caps the ward input at 6 | pass | `screenshots/01-get-help-palika.png` |
| Status lookup shows Updates (taken, delivered) and "3 households served" | pass | `screenshots/02-status-events.png` |
| Coverage page lists 8 ward rows for the Melamchi incident, never-delivered first, with 3W downloads | pass | `screenshots/03-coverage.png` |
| Sign in with the dev test form, My Page shows the handled need with "Returns to the open pool in N days" | pass | `screenshots/04-me-handled.png` |
| "Mark delivered" opens the dialog with the delivery receipt fields | pass | `screenshots/05-me-deliver-dialog.png` |
| Opening `/status/<code>` directly loads the status | **fail** | see Finding 2 |

## Findings

**1. Receipt photo upload fails on dev (`client authentication failed`).** Environment, not code.
A Terraform apply on dev earlier today (adding the hourly schedule) ran without the secret variables
and removed `TURNSTILE_SECRET` and `OU_MEDIA_CLIENT_SECRET` from the Lambda. Turnstile was restored
from SSM the same evening. The media secret value was never recorded and the dev OnlyUtils client
already holds the maximum of two secrets, so a new one cannot be minted until the owner deletes one
in the console. Tracked in the infra repo `HANDOFF.md` ("Dev apply command"). Until then, delivery
without a photo works; a helper who attaches a photo sees an upload error.

**2. `/status/<code>` opens the Get help page with an empty lookup box.** Pre-existing gap that
matters more now that requester updates exist. Fix in progress (Codex): read the code from the URL,
prefill the lookup and fetch on load.

**3. Slow first load of My Page.** The dashboard stayed on "Loading your things" for roughly ten
seconds for the helper account on a cold start. Not new to this slice; noted for the offline slice.

## Not covered

- Photo attached to a delivery (blocked by Finding 1). The server path is unit-tested.
- Anonymous need submission through the browser (Turnstile blocks headless browsers by design).
- Nepali-language rendering of the new strings (typecheck and i18n tests only).

## How to repeat

Scripts live in the session scratchpad, not the repo: `run.mjs` (API checks; needs the fixture
passwords) and `browser.mjs` (CDP driver; start Chrome with `--remote-debugging-port=9333` first).
Both can be recreated from this report and [BETA-TESTING.md](../../BETA-TESTING.md).
