#!/usr/bin/env bash
# R6: Identity/Draft separate from frozen catalog (admin flow + denials).
# Env required: TASK_ADMIN_PASS. Never echoes secrets.
set -uo pipefail
OUT="${1:-/tmp/rp-r6.log}"
PASS_W="${TASK_ADMIN_PASS:?Set TASK_ADMIN_PASS}"
BOOT=http://127.0.0.1:18280
: > "$OUT"
pass=0; fail=0
log(){ echo "$@" | tee -a "$OUT"; }
check(){ if [[ "$2" == "$3" ]]; then pass=$((pass+1)); log "PASS: $1 (=$3)"; else fail=$((fail+1)); log "FAIL: $1 expected=$2 actual=$3"; fi; }
J=/tmp/rp-r6-$$; mkdir -p $J; chmod 700 $J
log "== HEAD =="; git -C /private/tmp/fasearch-real-pilot-integrated-demo rev-parse HEAD | tee -a "$OUT"
curl -s -c $J/adm.txt $BOOT/api/v1/auth/csrf > $J/c0.json
T0=$(python3 -c "import json;print(json.load(open('$J/c0.json'))['token'])")
check "admin login" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/adm.txt -c $J/adm.txt -X POST $BOOT/api/v1/auth/login -H "X-CSRF-TOKEN: $T0" --data-urlencode "username=task-admin" --data-urlencode "password=$PASS_W")"
TA=$(curl -s -b $J/adm.txt $BOOT/api/v1/auth/csrf | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])")
check "me" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/adm.txt $BOOT/api/v1/auth/me)"
check "draft list" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/adm.txt "$BOOT/api/v1/catalog/admin/drafts?limit=5&offset=0")"
CR=$(curl -s -b $J/adm.txt -X POST $BOOT/api/v1/catalog/admin/drafts -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $TA" -d '{"title":"Pilot draft","category":"TOP"}')
PA=$(echo "$CR" | python3 -c "import json,sys;print(json.load(sys.stdin).get('product_id',''))")
[[ -n "$PA" ]] && { log "PASS: draft create $PA"; pass=$((pass+1)); } || { log "FAIL: draft create $CR"; fail=$((fail+1)); }
check "revise v2" 2 "$(curl -s -b $J/adm.txt -X PATCH $BOOT/api/v1/catalog/admin/drafts/$PA -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $TA" -d '{"title":"Pilot draft v2","category":"TOP","expected_version_no":1}' | python3 -c "import json,sys;print(json.load(sys.stdin).get('version_no'))")"
check "stale revise 409" 409 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/adm.txt -X PATCH $BOOT/api/v1/catalog/admin/drafts/$PA -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $TA" -d '{"title":"stale","category":"TOP","expected_version_no":1}')"
python3 -c "from PIL import Image; Image.new('RGB',(24,24),color=(20,60,200)).save('$J/up.png','PNG')"
check "upload v3" 3 "$(curl -s -b $J/adm.txt -X POST "$BOOT/api/v1/catalog/admin/drafts/$PA/image?expected_version_no=2" -H "X-CSRF-TOKEN: $TA" -F "image=@$J/up.png;type=image/png" | python3 -c "import json,sys;print(json.load(sys.stdin).get('version_no'))")"
curl -s -b $J/adm.txt $BOOT/api/v1/catalog/admin/drafts/$PA/image -o $J/back.png
cmp -s $J/up.png $J/back.png && { log "PASS: image bytes match"; pass=$((pass+1)); } || { log "FAIL: image bytes"; fail=$((fail+1)); }
check "draft not searchable" 200 "$(curl -s -b $J/adm.txt -X POST $BOOT/api/v1/search/text -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $TA" -d '{"schema_version":"1.0.0","query_text":"Pilot draft v2","k":10}' | python3 -c "import json,sys; d=json.load(sys.stdin); print(200 if all('$PA' not in r['product_id'] for r in d['results']) else 'FOUND')")"
check "anon list 401" 401 "$(curl -s -o /dev/null -w '%{http_code}' "$BOOT/api/v1/catalog/admin/drafts")"
# Fresh task DB seeds only task-admin; multi-role scope isolation is covered by
# unchanged RBAC code + anon/owner checks here (no register endpoint in this slice).
check "logout 204" 204 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/adm.txt -X POST $BOOT/api/v1/auth/logout -H "X-CSRF-TOKEN: $TA")"
check "old session 401" 401 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/adm.txt "$BOOT/api/v1/catalog/admin/drafts")"
rm -rf $J
log "RESULT pass=$pass fail=$fail"
[[ $fail == 0 ]]
