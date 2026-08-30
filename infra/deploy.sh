#!/usr/bin/env bash
# Deploy verifiednepal to Cloudflare Pages (onlyutils account).
#
# Usage: ./infra/deploy.sh dev|prod
#
# Auth: the shared Cloudflare token lives in AWS SSM Parameter Store
# (onlyutils out-mgmt account) — never in this repo. Requires the AWS CLI
# with the out-mgmt profile and node/pnpm.
#
# One-time setup already done (2026-08-30): Pages projects created,
# dev.verifiednepal.com custom domain + proxied CNAME in the
# verifiednepal.com zone (f781a2cb8eae396308b3d57fb39cb172).
# Prod (apex + www) is created by this script on first prod deploy but
# ONLY after owner approval.
set -euo pipefail

ENV="${1:?usage: deploy.sh dev|prod}"
cd "$(dirname "$0")/.."

case "$ENV" in
  dev)  PROJECT=verifiednepal-dev ;;
  prod) PROJECT=verifiednepal ;;
  *) echo "unknown env: $ENV" >&2; exit 1 ;;
esac

# --region is required: the out-mgmt profile's default region is wrong for
# this parameter and the CLI fails silently otherwise (see onyutils
# docs/operations.md §6).
export CLOUDFLARE_API_TOKEN=$(aws ssm get-parameter --profile out-mgmt \
  --name /onyutils/shared/cloudflare-api-token --with-decryption \
  --region us-east-1 --query Parameter.Value --output text)
# Account id is derived from the token, not committed to the repo.
export CLOUDFLARE_ACCOUNT_ID=$(curl -sf https://api.cloudflare.com/client/v4/accounts \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" |
  python3 -c 'import json,sys;print(json.load(sys.stdin)["result"][0]["id"])')
test -n "$CLOUDFLARE_ACCOUNT_ID" || { echo "could not resolve Cloudflare account id" >&2; exit 1; }

pnpm install --frozen-lockfile
pnpm typecheck
pnpm build

npx --yes wrangler@latest pages deploy dist --project-name "$PROJECT" \
  --branch main --commit-dirty=true

echo "Deployed to $PROJECT ($ENV)."
