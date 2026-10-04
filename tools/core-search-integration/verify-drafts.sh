#!/usr/bin/env bash
# Draft lifecycle proof: create/revise/stale-409/upload/bytes/scopes/denials.
# Disposable task data only. Usage: verify-drafts.sh <out.log>
# Secret handling: password comes ONLY from env TASK_ADMIN_PASS (disposable
# test credential, never logged, never committed); cookie jars are 0600.
set -uo pipefail
umask 077
OUT="${1:-/tmp/verify-drafts.log}"
BOOT=http://127.0.0.1:18180
PASS_W="${TASK_ADMIN_PASS:?Set TASK_ADMIN_PASS}"
: > "$OUT"
chmod 600 "$OUT"
pass=0; fail=0
log() { echo "$@" | tee -a "$OUT"; }
check() { if [[ "$2" == "$3" ]]; then pass=$((pass+1)); log "PASS: $1 (=$3)"; else fail=$((fail+1)); log "FAIL: $1 expected=$2 actual=$3"; fi; }
J=/tmp/dj-proof; mkdir -p $J; chmod 700 $J
login() { curl -s -c $J/$1.txt $BOOT/api/v1/auth/csrf > $J/c-$1.json; chmod 600 $J/$1.txt $J/c-$1.json; T=$(python3 -c "import json;print(json.load(open('$J/c-$1.json'))['token'])"); curl -s -b $J/$1.txt -c $J/$1.txt -X POST $BOOT/api/v1/auth/login -H "X-CSRF-TOKEN: $T" --data-urlencode "username=$1" --data-urlencode "password=$PASS_W" > /dev/null; chmod 600 $J/$1.txt; curl -s -b $J/$1.txt $BOOT/api/v1/auth/csrf | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])"; }
log "HEAD=$(git -C /private/tmp/fasearch-core-search-integration-2h rev-parse HEAD)"
TA=$(login task-admin); SA=$(login scope-staff-a); SB=$(login scope-staff-b)
log "logins ok"
CR=$(curl -s -b $J/scope-staff-a.txt -X POST $BOOT/api/v1/catalog/admin/drafts -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $SA" -d '{"title":"Áo proof","category":"TOP"}')
PA=$(echo "$CR" | python3 -c "import json,sys;print(json.load(sys.stdin)['product_id'])")
check "create v1" 1 "$(echo "$CR" | python3 -c "import json,sys;print(json.load(sys.stdin)['version_no'])")"
RV=$(curl -s -b $J/scope-staff-a.txt -X PATCH $BOOT/api/v1/catalog/admin/drafts/$PA -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $SA" -d '{"title":"Áo proof fixed","category":"TOP","expected_version_no":1}')
check "revise v2" 2 "$(echo "$RV" | python3 -c "import json,sys;print(json.load(sys.stdin)['version_no'])")"
check "stale revise 409" 409 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/scope-staff-a.txt -X PATCH $BOOT/api/v1/catalog/admin/drafts/$PA -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $SA" -d '{"title":"Stale","category":"TOP","expected_version_no":1}')"
python3 -c "from PIL import Image; Image.new('RGB',(24,24),color=(20,60,200)).save('/tmp/proof.png','PNG')"
UP=$(curl -s -b $J/scope-staff-a.txt -X POST "$BOOT/api/v1/catalog/admin/drafts/$PA/image?expected_version_no=2" -H "X-CSRF-TOKEN: $SA" -F 'image=@/tmp/proof.png;type=image/png')
check "upload v3 primary" "3-True" "$(echo "$UP" | python3 -c "import json,sys;d=json.load(sys.stdin);print(str(d['version_no'])+'-'+str(d['has_primary_image']))")"
curl -s -b $J/scope-staff-a.txt $BOOT/api/v1/catalog/admin/drafts/$PA/image -o /tmp/proof-back.png
cmp /tmp/proof.png /tmp/proof-back.png && { log "PASS: image bytes match"; pass=$((pass+1)); } || { log "FAIL: image bytes"; fail=$((fail+1)); }
check "stale upload 409" 409 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/scope-staff-a.txt -X POST "$BOOT/api/v1/catalog/admin/drafts/$PA/image?expected_version_no=2" -H "X-CSRF-TOKEN: $SA" -F 'image=@/tmp/proof.png;type=image/png')"
CB=$(curl -s -b $J/scope-staff-b.txt -X POST $BOOT/api/v1/catalog/admin/drafts -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $SB" -d '{"title":"Quần proof B","category":"BOTTOM"}')
PB=$(echo "$CB" | python3 -c "import json,sys;print(json.load(sys.stdin)['product_id'])")
check "staffA own-only (no B titles)" "ok" "$(curl -s -b $J/scope-staff-a.txt "$BOOT/api/v1/catalog/admin/drafts?limit=10&offset=0" | python3 -c "import json,sys;ts=[i['title'] for i in json.load(sys.stdin)['items']];print('ok' if ts and all('Quần proof B'!=t and 'Quần của B'!=t for t in ts) else ts)")"
check "admin sees all >=2" "yes" "$(curl -s -b $J/task-admin.txt "$BOOT/api/v1/catalog/admin/drafts?limit=10&offset=0" | python3 -c "import json,sys;print('yes' if len(json.load(sys.stdin)['items'])>=2 else 'no')")"
check "A reads B 403" 403 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/scope-staff-a.txt $BOOT/api/v1/catalog/admin/drafts/$PB)"
check "registered 403" 403 "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/dj/scope-reg.txt "$BOOT/api/v1/catalog/admin/drafts")"
check "anon list 401" 401 "$(curl -s -o /dev/null -w '%{http_code}' "$BOOT/api/v1/catalog/admin/drafts")"
check "anon create 403" 403 "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BOOT/api/v1/catalog/admin/drafts -H 'Content-Type: application/json' -d '{"title":"x","category":"TOP"}')"
check "past-end empty" "0-False" "$(curl -s -b $J/task-admin.txt "$BOOT/api/v1/catalog/admin/drafts?limit=5&offset=9999" | python3 -c "import json,sys;d=json.load(sys.stdin);print(str(len(d['items']))+'-'+str(d['has_more']))")"
check "logout 204" 204 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/scope-staff-a.txt -X POST $BOOT/api/v1/auth/logout -H "X-CSRF-TOKEN: $SA")"
check "old session 401" 401 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/scope-staff-a.txt "$BOOT/api/v1/catalog/admin/drafts")"
log "RESULT pass=$pass fail=$fail"
exit $fail
