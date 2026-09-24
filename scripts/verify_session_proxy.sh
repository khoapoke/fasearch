#!/usr/bin/env bash
set -euo pipefail

web_origin="${FASEARCH_WEB_ORIGIN:-http://127.0.0.1:3000}"
username="${FASEARCH_TEST_USERNAME:?Set a test username}"
password="${FASEARCH_TEST_PASSWORD:?Set a test password}"
scratch="$(mktemp -d /tmp/fasearch-session-check.XXXXXX)"
chmod 700 "$scratch"
trap 'rm -f "$scratch/cookies" "$scratch/headers"; rmdir "$scratch"' EXIT

csrf_response="$(curl --fail --silent --show-error \
  --cookie-jar "$scratch/cookies" \
  --dump-header "$scratch/headers" \
  "$web_origin/api/auth/csrf")"
csrf="$(printf '%s' "$csrf_response" | jq -er '.token')"
header_name="$(printf '%s' "$csrf_response" | jq -er '.header_name')"
if ! rg -iq '^set-cookie: FASEARCH_SESSION=.*HttpOnly' "$scratch/headers"; then
  printf 'Session cookie was not forwarded with HttpOnly\n' >&2
  exit 1
fi

login_payload="$(jq -n --arg username "$username" --arg password "$password" \
  '{username: $username, password: $password}')"
login_response="$(curl --fail --silent --show-error \
  --cookie "$scratch/cookies" --cookie-jar "$scratch/cookies" \
  --header "$header_name: $csrf" \
  --header 'Content-Type: application/json' \
  --data "$login_payload" \
  "$web_origin/api/auth/login")"
printf '%s' "$login_response" | jq -e '.authenticated == true and (has("access_token") | not) and (has("refresh_token") | not)' >/dev/null

me_response="$(curl --fail --silent --show-error \
  --cookie "$scratch/cookies" "$web_origin/api/auth/me")"
printf '%s' "$me_response" | jq -e --arg username "$username" \
  '.username == $username and (.authorities | index("SECURITY_GOVERN") != null)' >/dev/null

fresh_csrf="$(curl --fail --silent --show-error \
  --cookie "$scratch/cookies" --cookie-jar "$scratch/cookies" \
  "$web_origin/api/auth/csrf" | jq -er '.token')"

created="$(curl --fail --silent --show-error \
  --cookie "$scratch/cookies" --cookie-jar "$scratch/cookies" \
  --header "$header_name: $fresh_csrf" \
  --header 'Content-Type: application/json' \
  --data '{"title":"Áo sơ mi xanh","description":"Cotton","category":"TOP"}' \
  "$web_origin/api/catalog/drafts")"
printf '%s' "$created" | jq -e '.status == "DRAFT" and .version_no == 1' >/dev/null
product_id="$(printf '%s' "$created" | jq -er '.product_id')"
revised="$(curl --fail --silent --show-error \
  --cookie "$scratch/cookies" --cookie-jar "$scratch/cookies" \
  --header "$header_name: $fresh_csrf" \
  --header 'Content-Type: application/json' \
  --request PATCH \
  --data '{"title":"Áo sơ mi xanh đậm","description":"Cotton","category":"TOP","expected_version_no":1}' \
  "$web_origin/api/catalog/drafts/$product_id")"
printf '%s' "$revised" | jq -e --arg id "$product_id" \
  '.product_id == $id and .status == "DRAFT" and .version_no == 2' >/dev/null

logout_status="$(curl --silent --show-error --output /dev/null \
  --write-out '%{http_code}' \
  --cookie "$scratch/cookies" --cookie-jar "$scratch/cookies" \
  --header "$header_name: $fresh_csrf" \
  --request POST "$web_origin/api/auth/logout")"
if [[ "$logout_status" != "204" ]]; then
  printf 'Logout returned %s instead of 204\n' "$logout_status" >&2
  exit 1
fi

after_logout="$(curl --silent --show-error --output /dev/null \
  --write-out '%{http_code}' \
  --cookie "$scratch/cookies" "$web_origin/api/auth/me")"
if [[ "$after_logout" != "401" ]]; then
  printf 'Session remains active after logout: %s\n' "$after_logout" >&2
  exit 1
fi

printf 'PASS: Next.js session proxy, CSRF login, RBAC, Draft versions 1→2, logout\n'
