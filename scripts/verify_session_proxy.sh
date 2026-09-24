#!/usr/bin/env bash
set -euo pipefail

web_origin="${FASEARCH_WEB_ORIGIN:-http://127.0.0.1:3000}"
if [[ "${FASEARCH_VERIFY_MODE:-web}" == "backend" ]]; then
  auth_prefix="/api/v1/auth"
  draft_prefix="/api/v1/catalog/admin/drafts"
  surface="Spring Boot API"
else
  auth_prefix="/api/auth"
  draft_prefix="/api/catalog/drafts"
  surface="Next.js session proxy"
fi
username="${FASEARCH_TEST_USERNAME:?Set a test username}"
password="${FASEARCH_TEST_PASSWORD:?Set a test password}"
scratch="$(mktemp -d /tmp/fasearch-session-check.XXXXXX)"
chmod 700 "$scratch"
trap 'rm -f "$scratch/cookies" "$scratch/headers" "$scratch/image"; rmdir "$scratch"' EXIT
stage="csrf"
trap 'printf "Verification failed at %s\n" "$stage" >&2' ERR

csrf_response="$(curl --fail --silent --show-error \
  --cookie-jar "$scratch/cookies" \
  --dump-header "$scratch/headers" \
  "$web_origin$auth_prefix/csrf")"
csrf="$(printf '%s' "$csrf_response" | jq -er '.token')"
header_name="$(printf '%s' "$csrf_response" | jq -er '.header_name')"
if ! rg -iq '^set-cookie: FASEARCH_SESSION=.*HttpOnly' "$scratch/headers"; then
  printf 'Session cookie was not forwarded with HttpOnly\n' >&2
  exit 1
fi

if [[ "${FASEARCH_VERIFY_MODE:-web}" == "backend" ]]; then
  login_payload="$(jq -nr --arg username "$username" --arg password "$password" \
    '"username=\($username | @uri)&password=\($password | @uri)"')"
  login_content_type="application/x-www-form-urlencoded"
else
  login_payload="$(jq -n --arg username "$username" --arg password "$password" \
    '{username: $username, password: $password}')"
  login_content_type="application/json"
fi
stage="login"
login_response="$(curl --fail --silent --show-error \
  --cookie "$scratch/cookies" --cookie-jar "$scratch/cookies" \
  --header "$header_name: $csrf" \
  --header "Content-Type: $login_content_type" \
  --data "$login_payload" \
  "$web_origin$auth_prefix/login")"
printf '%s' "$login_response" | jq -e '.authenticated == true and (has("access_token") | not) and (has("refresh_token") | not)' >/dev/null

stage="profile"
me_response="$(curl --fail --silent --show-error \
  --cookie "$scratch/cookies" "$web_origin$auth_prefix/me")"
printf '%s' "$me_response" | jq -e --arg username "$username" \
  '.username == $username and (.authorities | index("SECURITY_GOVERN") != null)' >/dev/null

stage="fresh-csrf"
fresh_csrf="$(curl --fail --silent --show-error \
  --cookie "$scratch/cookies" --cookie-jar "$scratch/cookies" \
  "$web_origin$auth_prefix/csrf" | jq -er '.token')"

stage="create-draft"
created="$(curl --fail --silent --show-error \
  --cookie "$scratch/cookies" --cookie-jar "$scratch/cookies" \
  --header "$header_name: $fresh_csrf" \
  --header 'Content-Type: application/json' \
  --data '{"title":"Áo sơ mi xanh","description":"Cotton","category":"TOP"}' \
  "$web_origin$draft_prefix")"
printf '%s' "$created" | jq -e '.status == "DRAFT" and .version_no == 1' >/dev/null
product_id="$(printf '%s' "$created" | jq -er '.product_id')"
stage="revise-draft"
revised="$(curl --fail --silent --show-error \
  --cookie "$scratch/cookies" --cookie-jar "$scratch/cookies" \
  --header "$header_name: $fresh_csrf" \
  --header 'Content-Type: application/json' \
  --request PATCH \
  --data '{"title":"Áo sơ mi xanh đậm","description":"Cotton","category":"TOP","expected_version_no":1}' \
  "$web_origin$draft_prefix/$product_id")"
printf '%s' "$revised" | jq -e --arg id "$product_id" \
  '.product_id == $id and .status == "DRAFT" and .version_no == 2' >/dev/null

if [[ -n "${FASEARCH_TEST_IMAGE:-}" ]]; then
  stage="upload-image"
  uploaded="$(curl --fail --silent --show-error \
    --cookie "$scratch/cookies" --cookie-jar "$scratch/cookies" \
    --header "$header_name: $fresh_csrf" \
    --form 'expected_version_no=2' \
    --form "image=@${FASEARCH_TEST_IMAGE}" \
    "$web_origin$draft_prefix/$product_id/image")"
  printf '%s' "$uploaded" | jq -e \
    '.status == "DRAFT" and .version_no == 3 and .has_primary_image == true' >/dev/null
  stage="read-image"
  curl --fail --silent --show-error \
    --cookie "$scratch/cookies" \
    --output "$scratch/image" \
    "$web_origin$draft_prefix/$product_id/image"
  cmp --silent "$FASEARCH_TEST_IMAGE" "$scratch/image"
fi

stage="logout"
logout_status="$(curl --silent --show-error --output /dev/null \
  --write-out '%{http_code}' \
  --cookie "$scratch/cookies" --cookie-jar "$scratch/cookies" \
  --header "$header_name: $fresh_csrf" \
  --request POST "$web_origin$auth_prefix/logout")"
if [[ "$logout_status" != "204" ]]; then
  printf 'Logout returned %s instead of 204\n' "$logout_status" >&2
  exit 1
fi

stage="post-logout"
after_logout="$(curl --silent --show-error --output /dev/null \
  --write-out '%{http_code}' \
  --cookie "$scratch/cookies" "$web_origin$auth_prefix/me")"
if [[ "$after_logout" != "401" ]]; then
  printf 'Session remains active after logout: %s\n' "$after_logout" >&2
  exit 1
fi

if [[ -n "${FASEARCH_TEST_IMAGE:-}" ]]; then
  printf 'PASS: %s, CSRF login, RBAC, Draft versions 1→3, S3 image bytes, logout\n' "$surface"
else
  printf 'PASS: %s, CSRF login, RBAC, Draft versions 1→2, logout\n' "$surface"
fi
