#!/usr/bin/env bash
set -euo pipefail

role_arn="arn:aws:iam::129264592326:role/OrganizationAccountAccessRole"
session="$(aws sts assume-role --profile out-mgmt --region ap-south-1 --role-arn "$role_arn" --role-session-name verifiednepal-web-e2e --output json)"
read -r AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN < <(
  python3 -c 'import json,sys; c=json.load(sys.stdin)["Credentials"]; print(c["AccessKeyId"],c["SecretAccessKey"],c["SessionToken"])' <<<"$session"
)
export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN

names=(
  "/verifiednepal-e2e/dev/MACHINE_CLIENT_ID"
  "/verifiednepal-admin/dev/ADMIN_MACHINE_CLIENT_SECRET"
)
params="$(aws ssm get-parameters --region ap-south-1 --with-decryption --names "${names[@]}" --output json)"
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN

while IFS=$'\t' read -r name value; do
  case "$name" in
    /verifiednepal-e2e/dev/MACHINE_CLIENT_ID) machine_id="$value" ;;
    /verifiednepal-admin/dev/ADMIN_MACHINE_CLIENT_SECRET) machine_secret="$value" ;;
  esac
done < <(python3 -c 'import json,sys; [print(p["Name"]+"\t"+p["Value"]) for p in json.load(sys.stdin)["Parameters"]]' <<<"$params")

if [[ -z "${machine_id:-}" || -z "${machine_secret:-}" ]]; then
  echo "Missing machine client parameters in SSM" >&2
  exit 1
fi
export E2E_MACHINE_CLIENT_ID="$machine_id" E2E_MACHINE_CLIENT_SECRET="$machine_secret"
token_form="$(python3 -c 'import os,urllib.parse; print(urllib.parse.urlencode({"grant_type":"client_credentials","client_id":os.environ["E2E_MACHINE_CLIENT_ID"],"client_secret":os.environ["E2E_MACHINE_CLIENT_SECRET"]}))')"
token_response="$(printf '%s' "$token_form" | curl -fsS https://auth.onlyutils.com/token -H 'content-type: application/x-www-form-urlencoded' --data-binary @-)"
machine_token="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])' <<<"$token_response")"

printf '%s\n' \
  "export E2E_MACHINE_TOKEN=$(printf '%q' "$machine_token")" \
  'export E2E_NEWS_API_BASE=https://api.news-dev.verifiednepal.com' \
  'export E2E_NEWS_SITE_BASE=https://news-dev.verifiednepal.com' \
  'export VITE_API_BASE=https://api.dev.verifiednepal.com' \
  'export VITE_NEWS_API_BASE=https://api.news-dev.verifiednepal.com' \
  'export VITE_NEWS_SITE_BASE=https://news-dev.verifiednepal.com'
