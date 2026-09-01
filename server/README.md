# VerifiedNepal Server

Standalone Lambda for API Gateway HTTP API v2 (`Node 22`, ESM).

## Env vars

| Var | Required | Description |
|---|---|---|
| `TABLE_NAME` | yes | DynamoDB table name |
| `AUTH_JWKS_URL` | no | JWKS URL (default `https://auth.onlyutils.com/.well-known/jwks.json`) |
| `AUTH_ISSUER` | no | Expected `iss` claim (default `https://auth.onlyutils.com`) |
| `AUTH_AUDIENCE` | no | Expected `aud` claim; when unset audience check is skipped |
| `AUTH_HOST` | no | OnlyUtils auth host for token exchange/refresh and `GET /me` userinfo (default `https://auth.onlyutils.com`) |
| `OU_CLIENT_ID` | yes | OnlyUtils OAuth client ID |
| `OU_CLIENT_SECRET` | no | OnlyUtils OAuth client secret (confidential client in prod; omit for public client in dev) |
| `ADMIN_EMAILS` | no | Comma-separated admin emails; first login with matching email gets `admin` role, otherwise `helper` |
| `MODERATOR_EMAILS` | no | Comma-separated moderator emails; first login with matching email gets `moderator` role (`ADMIN_EMAILS` wins if in both) |
| `OU_MEDIA_CLIENT_ID` | yes (for Phase 3) | OnlyUtils media service client ID for `client_credentials` machine token (`POST https://auth.onlyutils.com/token`) |
| `OU_MEDIA_CLIENT_SECRET` | yes (for Phase 3) | OnlyUtils media service client secret (cached until `expires_in`) |
| `MEDIA_HOST` | no | Media service host (default `https://media.onlyutils.com`; used as `${MEDIA_HOST}/v1/clients/{OU_MEDIA_CLIENT_ID}/media/files`) |
| `MEDIA_PUBLIC_BASE` | no | Public CDN base for `publicUrl` override (when set, `publicUrl` is `${MEDIA_PUBLIC_BASE}/{fileId}`) |

## Run

```bash
pnpm install
pnpm test
pnpm build
```

## Scripts

- `pnpm test` — `node --test` with locally generated RSA keypair and fake JWKS/DDB clients (no network).
- `pnpm build` — esbuild bundle to `dist/index.mjs` (Node 22, ESM, `aws-sdk` external) then `zip` to `dist/lambda.zip`.

## Routes

- `GET /health` → `{ok:true}`
- `GET /me` → `Authorization: Bearer <OnlyUtils ID token>` required. Verifies `RS256` against `AUTH_JWKS_URL` (cached), checks `iss` (`AUTH_ISSUER`), `aud` (`AUTH_AUDIENCE` when set), `exp`. OnlyUtils access tokens carry no email/name claims (`iss, sub, aud, exp, iat, jti, tid, cid, typ, scp, email_verified`). On first login (no `USER` item) fetches `GET ${AUTH_HOST}/userinfo` with the same Bearer token, uses `email ?? primary_email ?? emails[0]` and `name ?? display_name` from the userinfo response for the stored `USER` item and `ADMIN_EMAILS`/`MODERATOR_EMAILS` role bootstrap; userinfo failure returns `502 {error:'userinfo'}`. Existing users keep stored `email`/`role` without a userinfo call; missing fields are omitted from the stored item. Returns `{sub,email,name,role}`.
- `POST /auth/exchange` → `{code, code_verifier, redirect_uri}` → token endpoint `POST {AUTH_HOST}/token` (`grant_type=authorization_code`, `client_id=OU_CLIENT_ID`, `client_secret` when set)
- `POST /auth/refresh` → `{refresh_token}` → token endpoint `POST {AUTH_HOST}/token` (`grant_type=refresh_token`, `client_id`/`secret` same rule)
- `POST /projects` → anonymous (+ Turnstile) create project → `201 {id, updateCode}` (12-char base32, `updateCode` shown once, stored as `sha256` `updateCodeHash`; pointer `PCODE#<hash>`) 
- `GET /projects?district=&status=&cursor=` → public list (published|in-progress|completed via GSI1/GSI2, `coverPhoto` from first published photo, no private fields) 
- `GET /projects/{id}` → public detail (published photos/updates only, `coverPhoto`, masking) 
- `POST /projects/{id}/photos/presign` → committee (`X-Update-Code`) or mod (`Bearer`) → media presign via OnlyUtils (`client_credentials` token cached, `POST ${MEDIA_HOST}/v1/clients/{id}/media/files` with `Idempotency-Key`, `visibility:public`) → `{uploadUrl,fileId,publicUrl,headers?}` 
- `POST /projects/{id}/photos` → committee or mod add photo (mod publishes immediately, committee pending) 
- `POST /projects/{id}/updates` → committee add update (`text,photoFileIds,spentNpr`) pending 
- `GET /moderation/projects` → mod list all projects oldest-first with private fields + pending photos/updates 
- `POST /moderation/projects/{id}` → mod `verify-committee|publish|reject|set-status|publish-photo|reject-photo` (`publish` requires `committee.verified`; every action writes `AUDIT` item) 
- `POST /moderation/projects/{id}/updates/{updateId}` → mod `publish|reject` update 
- `POST /dispatches` → anonymous (+ Turnstile) create dispatch → `201 {id}` (pending)
- `GET /dispatches?tag=&cursor=` → anonymous list published dispatches (excerpts, tag filter)
- `GET /dispatches/{id}` → anonymous get single published dispatch
- `GET /moderation/dispatches` → moderator/admin list pending dispatches
- `POST /moderation/dispatches/{id}` → moderator/admin `publish|reject` dispatch (writes `AUDIT`)
- `POST /needs` → anonymous (+ Turnstile) create need → `201 {id, refCode}` (pending; the `claimCode` is minted by the moderator on publish)
- `GET /needs?district=&ward=&category=&status=&cursor=` → anonymous list needs (masked, status-filtered)
- `GET /status/{refCode}` → anonymous lookup need by refCode → `{status, category, district, createdAt, expiresAt}` plus `claimCode` once the need is published/matched/fulfilled
- `POST /needs/{refCode}/renew` → anonymous renew own need by refCode (extends TTL)
- `POST /offers` → helper (Bearer) create offer → `201 {id}` (pending)
- `GET /offers?district=&category=&cursor=` → anonymous list published offers
- `GET /moderation/queue` → moderator/admin (guidelines ack, district-scoped) list pending needs + offers
- `POST /moderation/{id}` → moderator/admin (guidelines ack, district-scoped) `publish|reject` need/offer (writes `AUDIT`, creates claim on publish)
- `POST /needs/{id}/status` → moderator/admin (guidelines ack, district-scoped) set status `matched|fulfilled|archived|rejected` (audit; matched may return contact)
- `POST /needs/{id}/flag` → anonymous (+ Turnstile) flag need → `201 {ok:true}` (increments flagCount, FLAGGED pointer)
- `GET /moderation/flags` → moderator/admin (guidelines ack) list flagged needs with reasons
- `POST /claims/{code}/redeem` → moderator/admin (guidelines ack, district-scoped) redeem single claim → `200 {status:"redeemed"}` or `409 already_redeemed`
- `POST /claims/sync` → moderator/admin (guidelines ack) batch redeem `{redemptions:[{code, redeemedAt, note?}]}` → `200 {results}`
- `GET /claims/print?district=&ward=` → moderator/admin (guidelines ack, district-scoped) printable claim codes for ward (masked, sorted)
- `GET /ledger?district=&ward=&format=` → anonymous public ledger (masked names, `json` or `csv`, requires district)
- `GET /audit?month=YYYY-MM&cursor=` → anonymous public audit log (masked targetLabel, `actorName` public)
- `POST /me/ack-guidelines` → authenticated (Bearer) acknowledge moderation guidelines → `200 {guidelinesAckAt}`
- `GET /admin/users?role=&cursor=` → admin list users by role
- `GET /admin/users/lookup?email=` → admin lookup user by email
- `POST /admin/users/{sub}/role` → admin set `role` + `districts` (self-demotion blocked, writes `AUDIT`)
- `GET /admin/stats` → admin counts for needs/offers/projects/dispatches by status, moderators, oldest pending age
- Other routes → `404 {error:"Not Found"}`. Errors never include stack traces.
