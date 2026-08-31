# VerifiedNepal Server — Phase 0

Standalone Lambda for API Gateway HTTP API v2 (`Node 22`, ESM).

## Env vars

| Var | Required | Description |
|---|---|---|
| `TABLE_NAME` | yes | DynamoDB table name |
| `GOOGLE_CLIENT_ID` | yes | Google OAuth client ID (`aud` claim) |
| `ADMIN_EMAILS` | no | Comma-separated admin emails; first login with matching email gets `admin` role, otherwise `helper` |

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
- `GET /me` → `Authorization: Bearer <Google ID token>` required. Verifies `RS256` against `https://www.googleapis.com/oauth2/v3/certs` (cached), checks `iss`, `aud`, `exp`. On first login creates `PK=USER#<sub> SK=PROFILE` with `role` `admin`/`helper`. Returns `{sub,email,name,role}`.
- Other routes → `404 {error:"Not Found"}`. Errors never include stack traces.
