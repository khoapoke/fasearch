#!/bin/bash
# Live account lifecycle against FE proxies -> Boot (two cookie jars + other user).
# Usage: ./e2e-account-lifecycle.sh <fe-base-url>
# Exit non-zero on the first failed expectation. Test-only credentials.
set -u
FE="${1:-http://127.0.0.1:3240}"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) E2E"
STAMP="$(date +%s)"
U1="e2e_user_${STAMP}"
U2="e2e_other_${STAMP}"
P1="e2e-initial-test-passphrase-01"
P2="e2e-renewed-test-passphrase-02"
J1="$(mktemp -d)/jar"; J2="$(mktemp -d)/jar"; J3="$(mktemp -d)/jar"
trap 'rm -rf "$(dirname "$J1")" "$(dirname "$J2")" "$(dirname "$J3")"' EXIT

pass=0
expect() { # expect <desc> <actual> <wanted>
  if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "ok $pass - $1";
  else echo "FAIL: $1 (got $2, want $3)"; exit 1; fi
}
csrf() { # csrf <jar> -> token
  curl -s -c "$1" -b "$1" -A "$UA" "$FE/api/auth/csrf" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])"
}
code_of() { tail -n1; }

echo "== register U1 (201, no autologin) =="
T1="$(csrf "$J1")"
C="$(curl -s -c "$J1" -b "$J1" -A "$UA" -H "X-CSRF-TOKEN: $T1" -H 'Content-Type: application/json' \
  -d "{\"username\":\"$U1\",\"email\":\"$U1@example.test\",\"password\":\"$P1\",\"display_name\":\"E2E User\"}" \
  -o /tmp/e2e-reg.json -w '%{http_code}' "$FE/api/auth/register")"
expect "register 201" "$C" "201"
C="$(curl -s -b "$J1" -A "$UA" -o /dev/null -w '%{http_code}' "$FE/api/auth/me")"
expect "no autologin after register" "$C" "401"

echo "== duplicate register (409 generic) =="
T1="$(csrf "$J1")"
C="$(curl -s -c "$J1" -b "$J1" -A "$UA" -H "X-CSRF-TOKEN: $T1" -H 'Content-Type: application/json' \
  -d "{\"username\":\"$U1\",\"email\":\"other@example.test\",\"password\":\"$P1\"}" \
  -o /tmp/e2e-dup.json -w '%{http_code}' "$FE/api/auth/register")"
expect "duplicate 409" "$C" "409"

echo "== login U1 on two jars =="
for J in "$J1" "$J2"; do
  T="$(csrf "$J")"
  C="$(curl -s -c "$J" -b "$J" -A "$UA" -H "X-CSRF-TOKEN: $T" -H 'Content-Type: application/json' \
    -d "{\"username\":\"$U1\",\"password\":\"$P1\"}" -o /dev/null -w '%{http_code}' "$FE/api/auth/login")"
  expect "login 200 ($J)" "$C" "200"
  C="$(curl -s -b "$J" -A "$UA" -o /dev/null -w '%{http_code}' "$FE/api/auth/profile")"
  expect "profile 200 ($J)" "$C" "200"
done

echo "== other user unaffected baseline =="
T3="$(csrf "$J3")"
C="$(curl -s -c "$J3" -b "$J3" -A "$UA" -H "X-CSRF-TOKEN: $T3" -H 'Content-Type: application/json' \
  -d "{\"username\":\"$U2\",\"email\":\"$U2@example.test\",\"password\":\"$P1\"}" -o /dev/null -w '%{http_code}' "$FE/api/auth/register")"
expect "other register 201" "$C" "201"
T3="$(csrf "$J3")"
C="$(curl -s -c "$J3" -b "$J3" -A "$UA" -H "X-CSRF-TOKEN: $T3" -H 'Content-Type: application/json' \
  -d "{\"username\":\"$U2\",\"password\":\"$P1\"}" -o /dev/null -w '%{http_code}' "$FE/api/auth/login")"
expect "other login 200" "$C" "200"

echo "== profile edit + protected rejection =="
T1="$(csrf "$J1")"
C="$(curl -s -c "$J1" -b "$J1" -A "$UA" -H "X-CSRF-TOKEN: $T1" -H 'Content-Type: application/json' \
  -d '{"display_name":"Tên Mới E2E"}' -o /tmp/e2e-patch.json -w '%{http_code}' -X PATCH "$FE/api/auth/profile")"
expect "patch 200" "$C" "200"
C="$(curl -s -b "$J1" -A "$UA" "$FE/api/auth/profile" | python3 -c "import sys,json;print(json.load(sys.stdin)['display_name'])")"
expect "display_name persisted" "$C" "Tên Mới E2E"
T1="$(csrf "$J1")"
C="$(curl -s -c "$J1" -b "$J1" -A "$UA" -H "X-CSRF-TOKEN: $T1" -H 'Content-Type: application/json' \
  -d '{"display_name":"OK","username":"hacker"}' -o /dev/null -w '%{http_code}' -X PATCH "$FE/api/auth/profile")"
expect "protected field 400" "$C" "400"

echo "== wrong current password rejected =="
T1="$(csrf "$J1")"
C="$(curl -s -c "$J1" -b "$J1" -A "$UA" -H "X-CSRF-TOKEN: $T1" -H 'Content-Type: application/json' \
  -d '{"current_password":"wrong-current-passphrase-00","new_password":"'"$P2"'"}' \
  -o /dev/null -w '%{http_code}' "$FE/api/auth/password")"
expect "wrong current 400" "$C" "400"
C="$(curl -s -b "$J1" -A "$UA" -o /dev/null -w '%{http_code}' "$FE/api/auth/me")"
expect "session survives wrong attempt" "$C" "200"

echo "== valid password change revokes both sessions =="
T1="$(csrf "$J1")"
C="$(curl -s -c "$J1" -b "$J1" -A "$UA" -H "X-CSRF-TOKEN: $T1" -H 'Content-Type: application/json' \
  -d '{"current_password":"'"$P1"'","new_password":"'"$P2"'"}' \
  -o /dev/null -w '%{http_code}' "$FE/api/auth/password")"
expect "password change 204" "$C" "204"
C="$(curl -s -b "$J1" -A "$UA" -o /dev/null -w '%{http_code}' "$FE/api/auth/me")"
expect "jar1 revoked" "$C" "401"
C="$(curl -s -b "$J2" -A "$UA" -o /dev/null -w '%{http_code}' "$FE/api/auth/me")"
expect "jar2 revoked" "$C" "401"
C="$(curl -s -b "$J3" -A "$UA" -o /dev/null -w '%{http_code}' "$FE/api/auth/me")"
expect "other user intact" "$C" "200"

echo "== old dead, new works, logout 401 =="
J4="$(mktemp -d)/jar"
T4="$(csrf "$J4")"
C="$(curl -s -c "$J4" -b "$J4" -A "$UA" -H "X-CSRF-TOKEN: $T4" -H 'Content-Type: application/json' \
  -d "{\"username\":\"$U1\",\"password\":\"$P1\"}" -o /dev/null -w '%{http_code}' "$FE/api/auth/login")"
expect "old password 401" "$C" "401"
T4="$(csrf "$J4")"
C="$(curl -s -c "$J4" -b "$J4" -A "$UA" -H "X-CSRF-TOKEN: $T4" -H 'Content-Type: application/json' \
  -d "{\"username\":\"$U1\",\"password\":\"$P2\"}" -o /dev/null -w '%{http_code}' "$FE/api/auth/login")"
expect "new password 200" "$C" "200"
T4="$(csrf "$J4")"
C="$(curl -s -c "$J4" -b "$J4" -A "$UA" -H "X-CSRF-TOKEN: $T4" -o /dev/null -w '%{http_code}' -X POST "$FE/api/auth/logout")"
expect "logout 204" "$C" "204"
C="$(curl -s -b "$J4" -A "$UA" -o /dev/null -w '%{http_code}' "$FE/api/auth/me")"
expect "post-logout 401" "$C" "401"
rm -rf "$(dirname "$J4")"

echo "== negative: CSRF/415/open-redirect =="
C="$(curl -s -A "$UA" -H 'Content-Type: application/json' \
  -d '{"username":"x","email":"x@example.test","password":"'"$P1"'"}' \
  -o /dev/null -w '%{http_code}' "$FE/api/auth/register")"
expect "missing CSRF 403" "$C" "403"
T1="$(csrf "$J1")"
C="$(curl -s -c "$J1" -b "$J1" -A "$UA" -H "X-CSRF-TOKEN: $T1" -H 'Content-Type: text/plain' \
  -d 'hello' -o /dev/null -w '%{http_code}' "$FE/api/auth/register")"
expect "wrong content 415" "$C" "415"
C="$(curl -s -A "$UA" -o /dev/null -w '%{redirect_url}' "$FE/dang-nhap?next=https://evil.test/x" | grep -c evil || true)"
expect "no open redirect leak" "$C" "0"

echo "ALL $pass EXPECTATIONS PASSED"
