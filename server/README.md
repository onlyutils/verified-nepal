# VerifiedNepal Server — Phase 0

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
- `GET /me` → `Authorization: Bearer <OnlyUtils ID token>` required. Verifies `RS256` against `AUTH_JWKS_URL` (cached), checks `iss` (`AUTH_ISSUER`), `aud` (`AUTH_AUDIENCE` when set), `exp`. OnlyUtils access tokens carry no email/name claims (`iss, sub, aud, exp, iat, jti, tid, cid, typ, scp, email_verified`). On first login (no `USER` item) fetches `GET ${AUTH_HOST}/userinfo` with the same Bearer token, uses `email ?? primary_email` and `name ?? display_name` from the userinfo response for the stored `USER` item and `ADMIN_EMAILS`/`MODERATOR_EMAILS` role bootstrap; userinfo failure returns `502 {error:'userinfo'}`. Existing users keep stored `email`/`role` without a userinfo call; missing fields are omitted from the stored item. Returns `{sub,email,name,role}`.
- `POST /auth/exchange` → `{code, code_verifier, redirect_uri}` → token endpoint `POST {AUTH_HOST}/token` (`grant_type=authorization_code`, `client_id=OU_CLIENT_ID`, `client_secret` when set)
- `POST /auth/refresh` → `{refresh_token}` → token endpoint `POST {AUTH_HOST}/token` (`grant_type=refresh_token`, `client_id`/`secret` same rule)
- Other routes → `404 {error:"Not Found"}`. Errors never include stack traces.
