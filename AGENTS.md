# AGENTS.md

Agent notes for this repository.

## Deploy contract (since 2026-10-28)

- Deploy only through `infra/deploy.sh <env> [component] [--dry-run]`; GitHub workflows and humans use the same script (see README "Deploying").
- GitHub holds only `AWS_ROLE_ARN` per environment (OIDC). Do not add repository variables or secrets; config and secrets live in SSM (`/ci/<project>/<env>/...`, `/<project>/<env>/frontend/...`).
- `infra/load-env.sh` and `infra/load-env.test.sh` are byte-identical in the five repos (cms, web, admin, news, infra): change all five and run `bash infra/load-env.test.sh`.
- Prod workflows are `workflow_dispatch`-only and default `dry_run=true`. Do not dispatch with `dry_run=false` unless the owner asks. Never print secrets.
- Full contract, accounts/state map, rules and known limitations: `docs/deploy-contract.md` in the private `verifiednepal-infra` repo (this repo is public: never commit account ids or role ARNs here).
- Known here: `load-env.sh` also masks non-secret values (limitation 3).
- Known here: `docs/e2e/2026-09-06/DEV-DATASET.md` names a retired account id (limitation 6). `main` is squash-merge only.
