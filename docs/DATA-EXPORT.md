# Data Export Guide for Organization Information Officers

This guide is for INGO, NGO, and government information officers who need to
read Verified Nepal's public data. It covers what is public, the API
endpoints, the administrative code system, and how to load the data into
HDX or a 3W template.

## 1. What is public and what is not

Verified Nepal publishes aggregate and per-delivery data for coordination.
It never publishes anything that could identify a beneficiary.

| Data | Public | Notes |
|---|---|---|
| Beneficiary name | Masked only | For example "Ram K." instead of a full name |
| Beneficiary phone | Never | Not included in any public response |
| District, municipality, ward | Public | |
| Category and status of need | Public | open / in progress / delivered |
| Standard kit and planned households | Public | Kit name and the number of households requested; line items stay private |
| Household count served | Public | |
| Delivery receipt photo | Private | Moderators only |
| Delivery location detail beyond ward | Private | Moderators only |
| Delivering organization or helper label | Public | |
| Moderation and audit actions | Public, masked | Actor name is public; the affected person's label is masked |

## 2. Base URLs

| Environment | Base URL | Notes |
|---|---|---|
| Production | `https://api.verifiednepal.com` | Live data |
| Development | `https://api.dev.verifiednepal.com` | Example/test data only. Do not use for reporting. |

All endpoints below are unauthenticated. Replace `$BASE` with the base URL
for your environment.

### 2.1 GET /incidents

Use this first to find the `incidentId` values needed by `/coverage` and
`/export/3w`.

| Param | Values | Default |
|---|---|---|
| `status` | comma-separated `active`, `archived` | `active` |

Response: `{ "items": [ incident, ... ] }`. Each incident carries only the
public fields: `id`, `name`, `nameNe`, `kind`, `status`, `startedAt`,
`affectedDistricts`, `summary`, `summaryNe`, `coverImageUrl`,
`landingPagePath`, `sourceAttribution`, `createdAt`. No explicit cache
header is set.

```bash
curl "$BASE/incidents?status=active"
```

### 2.2 GET /coverage

Ward-level coverage for one incident: counts of open, matched, and
fulfilled needs per district/municipality/ward, and the last delivery date.

| Param | Required | Notes |
|---|---|---|
| `incidentId` | yes | Must be `active` or `archived`, else `404` |

```json
{
  "incidentId": "...",
  "generatedAt": "2026-09-07T00:00:00.000Z",
  "rows": [
    { "district": "Sindhupalchok", "municipalityId": 30303,
      "municipality": "Chautara Sangachokgadhi", "ward": 4,
      "open": 2, "matched": 1, "fulfilled": 5,
      "lastDeliveredAt": "2026-09-01T00:00:00.000Z" }
  ]
}
```

`lastDeliveredAt` is `null` if the ward never had a delivery; those rows
sort first. Cache: `public, max-age=300` (5 minutes).

```bash
curl "$BASE/coverage?incidentId=YOUR-INCIDENT-ID"
```

### 2.3 GET /export/3w

The Who-does-What-Where (3W) export for one incident, as HXL-tagged CSV or
GeoJSON.

| Param | Required | Values | Default |
|---|---|---|---|
| `incidentId` | yes | must be `active` or `archived` | — |
| `format` | no | `csv`, `geojson` | `csv` |

Cache: `public, max-age=300`. Both formats are served as an attachment,
filename `verifiednepal-3w-<incidentId>.<ext>`.

```bash
curl "$BASE/export/3w?incidentId=YOUR-INCIDENT-ID&format=csv" -o 3w.csv
curl "$BASE/export/3w?incidentId=YOUR-INCIDENT-ID&format=geojson" -o 3w.geojson
```

**CSV columns.** The CSV has two header rows: column name, then the HXL
hashtag for that column. This is the format
[HXL](https://hxlstandard.org) tools and HDX expect. Keep both rows when
loading the file; HXL-aware tools read the second row automatically and
hide it from display.

| Column | HXL tag | Meaning |
|---|---|---|
| `org` | `#org+name` | Delivering organization, helper group, "Helper", or "Moderator" |
| `sector` | `#sector+name` | Need category |
| `kit` | `#item+kit` | Standard kit id, blank for requests without a kit |
| `kit_households` | `#reached+households+planned` | Households covered by the requested standard kit |
| `activity` | `#activity+name` | Always `"relief delivery"` |
| `province` | `#adm1+name` | Province, looked up from district |
| `district` | `#adm2+name` | District name |
| `municipality` | `#adm3+name` | Municipality name |
| `municipality_code` | `#adm3+code` | BIPAD municipality id, see section 3 |
| `ward` | `#adm4+name` | Ward number |
| `status` | `#status` | `open`, `in progress`, or `delivered` |
| `registered` | `#date+start` | When the need was created |
| `delivered` | `#date+end` | When delivered, blank if not yet delivered |
| `households` | `#reached+households` | Households served, blank if unrecorded |
| `need_id` | `#meta+id` | Internal need id |

**Status values.** Internal need status is mapped to plain-English 3W
status: `published` -> `open`, `matched` -> `in progress`, `fulfilled` ->
`delivered`. Only these three statuses are ever exported; draft, rejected,
and expired needs never appear.

**municipality_code.** This is the numeric municipality id from Nepal's
BIPAD portal (`https://bipadportal.gov.np`), the same id Verified Nepal
uses internally. It is **not** an HDX/OCHA P-code. There is no mapping
table from BIPAD municipality id to HDX COD-AB P-codes in this codebase
today; join by district and municipality name instead (see section 3).

**GeoJSON.** `format=geojson` returns a `FeatureCollection`. Feature
properties are the same columns as the CSV (without the HXL row). Point
geometry falls back to the most specific location known for the need: ward
centroid, then municipality centroid, then district centroid. If none are
known, `geometry` is `null`.

### 2.4 GET /ledger

The public delivery ledger: one row per confirmed delivery.

| Param | Required | Notes |
|---|---|---|
| `district` | no | Filter to one district. Omit to list all districts (paginated). |
| `ward` | no | Filter to one ward (1-33). Requires `district`. |
| `format` | no | `json` (default) or `csv` |
| `cursor` | no | Opaque pagination cursor from a previous response |

Cache: `public, max-age=60` (1 minute).

CSV columns:

| Column | Meaning |
|---|---|
| `maskedName` | Masked beneficiary name |
| `category` | Need category |
| `district` | District name |
| `ward` | Ward number |
| `redeemedAt` | Delivery timestamp |
| `orgName` | Organization name, if delivered by an organization |
| `deliveredBy` | Display label for who delivered it |
| `deliveredByKind` | `org`, `group`, `helper`, or `field` |
| `municipality` | Municipality name, from the municipality id |
| `households` | Households served, blank if unrecorded |
| `receipt` | `yes` if a delivery receipt photo exists, else blank (photo itself stays private) |

JSON response: `{ "items": [...], "cursor": "..." }` (`cursor` present only
when there is another page). JSON items carry the same information as the
CSV columns, keyed as `maskedName`, `municipalityId`, `households`,
`receipt: true`, and a `deliveredBy` object `{kind, label}`.

```bash
curl "$BASE/ledger?district=Sindhupalchok&format=csv" -o ledger.csv
curl "$BASE/ledger?district=Sindhupalchok&ward=4"
```

### 2.5 GET /audit

Public moderation audit log, one entry per moderation action.

| Param | Required | Notes |
|---|---|---|
| `month` | yes | Format `YYYY-MM`, else `400` |
| `cursor` | no | Opaque pagination cursor |

Cache: `public, max-age=60`. Response: `{ "items": [...], "cursor": "..." }`.

| Field | Meaning |
|---|---|
| `ts` | Timestamp of the action |
| `actorName` | Public name of the moderator/admin who acted |
| `action` | The action taken |
| `targetType` | Type of thing acted on |
| `targetLabel` | Masked label of the target, or `—` if none; emails masked |
| `reason` | Present only if a reason was recorded; emails masked |

```bash
curl "$BASE/audit?month=2026-09"
```

### 2.6 GET /distributions

Public planned-distribution records for coordination. Filter by an active incident and,
optionally, district.

| Param | Required | Notes |
|---|---|---|
| `incidentId` | yes | Incident to list |
| `district` | no | District filter |

Response: `{ "items": [...] }`. Items include the organization and trust tier, district,
municipality id and name, wards, planned date, expanded item lines, transport, staff count,
status, acknowledgement role and time, completion time, and households reached. Public views
omit contact phones, the filing user's identity and acknowledgement names; any notes included
by the filing are treated as public coordination notes. Cache: `public, max-age=300`.

```bash
curl "$BASE/distributions?incidentId=YOUR-INCIDENT-ID&district=Sindhupalchok"
```

### 2.7 GET /export/ddmc-log

The DDMC daily log is a public, district-scoped export of distributions planned for one date.
It produces one row per distribution and ward, with two CSV header rows: plain column names
and HXL tags. JSON returns the same rows under `rows`.

| Param | Required | Values | Default |
|---|---|---|---|
| `district` | yes | VerifiedNepal district name | — |
| `date` | yes | `YYYY-MM-DD` planned date | — |
| `format` | no | `csv`, `json` | `csv` |

CSV columns are `date`, `district`, `municipality`, `ward`, `organization`, `tier`, `items`,
`transport`, `staff`, `status`, `acknowledged_by`, `acknowledged_at`, and
`households_reached`. The acknowledgement field contains only `moderator`, `admin`, or blank.
The CSV filename is `verifiednepal-ddmc-<district>-<date>.csv`; cache:
`public, max-age=300`.

```bash
curl "$BASE/export/ddmc-log?district=Sindhupalchok&date=2026-09-08&format=csv" -o ddmc.csv
curl "$BASE/export/ddmc-log?district=Sindhupalchok&date=2026-09-08&format=json"
```

### 2.8 GET /drones/board

The public drone tasking board combines open, assigned and flown payload requests, active
landing sites, active operators, and non-aborted flights scheduled from yesterday through
the next two days. Pass `incidentId` to limit payload requests to one incident.

```json
{
  "requests": [],
  "sites": [],
  "operators": [],
  "flights": []
}
```

Requests include location, expanded items, weight, cold-chain flag, priority, delivery window
and assignment status. Sites include their public infrastructure coordinates, surface and
clearance. Operators include organization, aircraft, payload, range, base district and permit
status. Flights include district, times, aircraft, organization and status. No response includes
beneficiary or requester names, phone numbers, operator or ground-contact details, or drop
photos. Cache: `public, max-age=120`.

```bash
curl "$BASE/drones/board?incidentId=YOUR-INCIDENT-ID"
```

### 2.9 GET /kits

The public standard-kit catalogue. It returns `{ "kits": [...] }`, cached for one day. Each
kit includes `id`, bilingual names, intended household size where applicable, line items with
category, quantity and unit, estimated `weightKg`, and its source. Kit line items are also
expanded privately when used in a distribution, drone payload request, or on-behalf need.

```bash
curl "$BASE/kits"
```

## 3. Administrative codes

Verified Nepal's municipality and district list is built from Nepal's
official BIPAD disaster portal public API
(`https://bipadportal.gov.np/api/v1`), covering the country's 753 local
governments (rural municipalities, municipalities, sub-metropolitan
cities, metropolitan cities).

Each municipality record has: `id` (the BIPAD municipality id, used as
`municipality_code` in the 3W export), `district`, `name`, `nameNe`,
`type`, `wards` (count), `lat`, `lng` (municipality centroid), and
`wardCentroids` (ward number to `[lat, lng]`; not every ward has one).
Each district record has `province` and a district centroid (`lat`,
`lng`).

### District name spelling

Eight district names differ between BIPAD's spelling and Verified Nepal's.
The build script remaps them:

| BIPAD spelling | Verified Nepal spelling |
|---|---|
| Terhathum | Tehrathum |
| Kapilbastu | Kapilvastu |
| Rukum East | RukumEast |
| Rukum West | RukumWest |
| Dhanusa | Dhanusha |
| Tanahu | Tanahun |
| Nawalparasi East | Nawalpur |
| Nawalparasi West | NawalparasiWest |

### Rebuilding the dataset

The dataset is rebuilt by hand, not on a schedule:

```bash
node scripts/build-admin-units.mjs
```

This fetches province, district, municipality, and ward data from BIPAD
and writes `server/src/data/admin-units.json`. Review the diff before
committing it.

### Joining with HDX COD-AB

There is no mapping table from BIPAD municipality id to HDX Common
Operational Datasets - Administrative Boundaries (COD-AB) P-codes in this
codebase. To join Verified Nepal data to P-coded HDX layers today, match on
district name (using the spelling table above) and municipality name. This
is a manual join.

## 4. Loading the CSV into HDX or a 3W template

Download the CSV from `GET /export/3w` (section 2.3), then open it in a
spreadsheet or an HXL tool such as the HXL Tag Assistant or HXL Proxy at
[hxlstandard.org](https://hxlstandard.org). Keep the second header row (the
`#adm1+name`, `#adm2+name`, ... hashtags) intact: HXL-aware tools, including
many HDX visualizations, read it automatically to understand each column,
regardless of the plain-text header name.

For a standard 3W matrix, map `org` to Who, `sector`/`activity` to What, and
`province`/`district`/`municipality`/`ward` to Where. To publish to HDX, add
the file as a resource on your organization's HDX dataset page; HDX
recognizes the HXL hashtag row automatically.

## 5. Limits

- Coverage, 3W export, public distributions and the DDMC log are cached 5 minutes
  (`public, max-age=300`). The drone board is cached 2 minutes (`public, max-age=120`),
  and the kit catalogue 1 day (`public, max-age=86400`). Ledger and audit are cached 1 minute
  (`public, max-age=60`).
- Coverage and 3W export are computed per request, over every district in
  the incident's `affectedDistricts`. There is no pre-built export file;
  each request re-reads and re-aggregates the underlying need records for
  that incident.
- No authentication or API key is required for any endpoint in this
  guide.
- There is no application-level rate limit beyond the throttle enforced
  by the underlying API gateway.

## 6. Contact

For questions about this data or to report a problem, email
verifiednepal01@gmail.com.
