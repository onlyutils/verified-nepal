#!/usr/bin/env bash
# Deploy verifiednepal to Cloudflare Pages or Lambda.
# Usage: infra/deploy.sh dev|prod [frontend|backend] [--dry-run]
set -euo pipefail

ENV="${1:?usage: infra/deploy.sh dev|prod [frontend|backend] [--dry-run]}"
shift
component=frontend
dry_run=false
if [[ $# -gt 0 && $1 != --dry-run ]]; then
  component=$1
  shift
fi
if [[ $# -gt 0 && $1 == --dry-run ]]; then
  dry_run=true
  shift
fi
if [[ $# -ne 0 ]]; then
  printf 'usage: infra/deploy.sh dev|prod [frontend|backend] [--dry-run]\n' >&2
  exit 2
fi
case $ENV in
  dev|prod) ;;
  *) printf 'unknown env: %s\n' "$ENV" >&2; exit 2 ;;
esac
case $component in
  frontend|backend) ;;
  *) printf 'unknown %s component: %s\n' "$ENV" "$component" >&2; exit 2 ;;
esac

if [[ ! ${EXPECT_ACCOUNT_ID:-} =~ ^[0-9]{12}$ ]]; then
  printf 'EXPECT_ACCOUNT_ID must be set to the expected 12-digit AWS account id\n' >&2
  exit 2
fi

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo_root=$(cd -- "$script_dir/.." && pwd)
cd "$repo_root"
export AWS_REGION=${AWS_REGION:-ap-south-1}
caller_account=$(aws sts get-caller-identity --query Account --output text)
if [[ $caller_account != "$EXPECT_ACCOUNT_ID" ]]; then
  printf 'AWS caller account does not match EXPECT_ACCOUNT_ID\n' >&2
  exit 1
fi

if [[ $ENV == dev ]]; then
  project=verifiednepal-dev
  lambda_function=verifiednepal-dev-api
else
  project=verifiednepal
  lambda_function=verifiednepal-prod-api
fi

if [[ $component == frontend ]]; then
  . "$script_dir/load-env.sh" "/verifiednepal-web/$ENV/frontend"
  . "$script_dir/load-env.sh" "/ci/verifiednepal-web/$ENV/deploy"
  if [[ $ENV == prod ]]; then
    if [[ -n ${VITE_ENABLE_TEST_LOGIN:-} ]]; then
      printf 'refusing prod deploy: VITE_ENABLE_TEST_LOGIN must be unset or empty\n' >&2
      exit 1
    fi
    : "${VITE_FLOOD_MANIFEST_URL:?set VITE_FLOOD_MANIFEST_URL (the prod published manifest URL)}"
    : "${VITE_API_BASE:?missing /verifiednepal-web/prod/frontend/VITE_API_BASE}"
    : "${VITE_OU_CLIENT_ID:?missing /verifiednepal-web/prod/frontend/VITE_OU_CLIENT_ID}"
    : "${VITE_NEWS_API_BASE:?missing /verifiednepal-web/prod/frontend/VITE_NEWS_API_BASE}"
    : "${VITE_NEWS_SITE_BASE:?missing /verifiednepal-web/prod/frontend/VITE_NEWS_SITE_BASE}"
    : "${VITE_CHAT_WIDGET_SRC:?missing /verifiednepal-web/prod/frontend/VITE_CHAT_WIDGET_SRC}"
    : "${VITE_CHAT_KEY:?missing /verifiednepal-web/prod/frontend/VITE_CHAT_KEY}"
    : "${VITE_CHAT_API:?missing /verifiednepal-web/prod/frontend/VITE_CHAT_API}"
    : "${VITE_TURNSTILE_SITE_KEY:?missing /verifiednepal-web/prod/frontend/VITE_TURNSTILE_SITE_KEY}"
    export VITE_FLOOD_MANIFEST_URL
  fi

  verify_response=$(curl --silent --show-error --fail \
    --request GET \
    --url https://api.cloudflare.com/client/v4/user/tokens/verify \
    --header @<(printf 'Authorization: Bearer %s\n' "$CLOUDFLARE_API_TOKEN"))
  token_status=$(jq -r '.result.status // empty' <<<"$verify_response")
  if [[ $token_status != active ]]; then
    printf 'Cloudflare API token verification failed or token is not active\n' >&2
    exit 1
  fi
  unset verify_response token_status

  if [[ $ENV == dev ]]; then
    commit_sha=${GITHUB_SHA:-$(git rev-parse HEAD)}
  fi
  pnpm install --frozen-lockfile
  pnpm typecheck
  pnpm build

  # Prod invokes Functions only on routes that have one, preserving the
  # existing quota behavior. Dev keeps its middleware coverage unchanged.
  if [[ $ENV == prod ]]; then
    python3 - <<'PY'
import json, pathlib
routes = []
for f in sorted(pathlib.Path("functions").rglob("*.ts")):
    parts = f.relative_to("functions").with_suffix("").parts
    if any(p.startswith("_") for p in parts):
        continue
    routes.append("/" + "/".join("*" if p.startswith("[") else p for p in parts))
json.dump({"version": 1, "include": routes, "exclude": []}, open("dist/_routes.json", "w"), indent=2)
print("prod _routes.json include:", routes)
PY
  fi

  if [[ $dry_run == true ]]; then
    printf 'DRY RUN: skipped wrangler pages deploy\n'
  elif [[ $ENV == prod ]]; then
    npx --yes wrangler@latest pages deploy dist --project-name "$project" \
      --branch main --commit-dirty=true
  else
    npx --yes wrangler@latest pages deploy dist \
      --project-name "$project" --branch main "--commit-hash=${commit_sha}"
  fi
else
  (cd server && pnpm install --frozen-lockfile && pnpm build)
  if [[ $dry_run == true ]]; then
    printf 'DRY RUN: skipped aws lambda update-function-code\n'
    printf 'DRY RUN: skipped aws lambda wait function-updated-v2\n'
  else
    aws lambda update-function-code \
      --function-name "$lambda_function" \
      --zip-file fileb://server/dist/lambda.zip \
      --region "$AWS_REGION"
    aws lambda wait function-updated-v2 \
      --function-name "$lambda_function" \
      --region "$AWS_REGION"
  fi
fi

if [[ $dry_run == true ]]; then
  printf 'Dry run complete for %s %s.\n' "$ENV" "$component"
else
  printf 'Deployed %s %s.\n' "$component" "$project"
fi
