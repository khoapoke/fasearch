#!/usr/bin/env bash
# R5: Actual loaded-token limits + failure handling on own stack.
# Env required: TASK_ADMIN_PASS. Never echoes secrets.
set -uo pipefail
OUT="${1:-/tmp/rp-r5.log}"
PASS_W="${TASK_ADMIN_PASS:?Set TASK_ADMIN_PASS}"
AI=http://127.0.0.1:18021; BOOT=http://127.0.0.1:18280; FE=http://127.0.0.1:3220
PUB_CATALOG=catalog-20260908-pilot-v1
PUB_MODEL="openai/clip-vit-base-patch32@092a3b7e3172+a6a0317b924b"
PUB_INDEX=faiss-flatip-week4-v1
: > "$OUT"
pass=0; fail=0
log(){ echo "$@" | tee -a "$OUT"; }
check(){ if [[ "$2" == "$3" ]]; then pass=$((pass+1)); log "PASS: $1 (=$3)"; else fail=$((fail+1)); log "FAIL: $1 expected=$2 actual=$3"; fi; }
J=/tmp/rp-r5-$$; mkdir -p $J; chmod 700 $J
log "== HEAD =="; git -C /private/tmp/fasearch-real-pilot-integrated-demo rev-parse HEAD | tee -a "$OUT"
curl -s -c $J/adm.txt $BOOT/api/v1/auth/csrf > $J/c0.json
T0=$(python3 -c "import json;print(json.load(open('$J/c0.json'))['token'])")
curl -s -b $J/adm.txt -c $J/adm.txt -X POST $BOOT/api/v1/auth/login -H "X-CSRF-TOKEN: $T0" --data-urlencode "username=task-admin" --data-urlencode "password=$PASS_W" > /dev/null
TA=$(curl -s -b $J/adm.txt $BOOT/api/v1/auth/csrf | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])")
curl -s -c $J/g.txt $FE/api/auth/csrf > $J/cg.json
HN=$(python3 -c "import json;print(json.load(open('$J/cg.json'))['header_name'])")
TK=$(python3 -c "import json;print(json.load(open('$J/cg.json'))['token'])")

# short valid TEXT (below 77 budget) works
check "short TEXT 200" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/adm.txt -X POST $BOOT/api/v1/search/text -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $TA" -d '{"schema_version":"1.0.0","query_text":"a","k":1}')"
# overflow: 200 words >> 77 tokens -> REJECT_MODEL_LIMIT before encode
python3 -c "import json; print(json.dumps({'schema_version':'1.0.0','query_text':'word '*200,'k':3,'trace_id':'tok-1','catalog_snapshot_id':'$PUB_CATALOG','model_version':'$PUB_MODEL','index_version':'$PUB_INDEX'}))" > $J/tok.json
check "overflow code" "TEXT_TOO_LONG" "$(curl -s -X POST $AI/internal/v1/search/text -H 'Content-Type: application/json' -H 'X-Trace-Id: tok-1' --data-binary @$J/tok.json | python3 -c 'import json,sys;print(json.load(sys.stdin).get("code"))')"
check "overflow Boot 400" 400 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/adm.txt -X POST $BOOT/api/v1/search/text -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $TA" --data-binary @$J/tok.json)"
# composed overflow
cp "/Users/khoado/Documents/ChatGPT/Graduate Bachelor/data/raw/dataset_a/images/11739.jpg" $J/q.jpg
python3 -c "print('word '*200)" > $J/long.txt
LONG=$(cat $J/long.txt)
check "composed overflow 400" 400 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/adm.txt -X POST $BOOT/api/v1/search/composed -H "X-CSRF-TOKEN: $TA" -F 'schema_version=1.0.0' -F "image=@$J/q.jpg;type=image/jpeg" -F "modification_text=$LONG" -F 'k=3')"
# invalid image / MIME / too-large / body caps / malformed / trace / K / CSRF
echo "not-an-image" > $J/bad.txt
check "invalid image 400" 400 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/adm.txt -X POST $BOOT/api/v1/search/composed -H "X-CSRF-TOKEN: $TA" -F 'schema_version=1.0.0' -F "image=@$J/bad.txt;type=image/jpeg" -F 'modification_text=x' -F 'k=3')"
check "mime mismatch 415" 415 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/adm.txt -X POST $BOOT/api/v1/search/composed -H "X-CSRF-TOKEN: $TA" -F 'schema_version=1.0.0' -F 'image=@/tmp/rp-q11739.jpg;type=image/png' -F 'modification_text=doi mau' -F 'k=3')"
python3 -c "print('{\"schema_version\":\"1.0.0\",\"query_text\":\"'+'y'*17000+'\",\"k\":3}')" > $J/big.json
check "16KiB Boot 413" 413 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/adm.txt -X POST $BOOT/api/v1/search/text -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $TA" --data-binary @$J/big.json)"
check "16KiB Next 413" 413 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/g.txt -X POST $FE/api/search/text -H 'Content-Type: application/json' -H "$HN: $TK" --data-binary @$J/big.json)"
check "badK 400" 400 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/adm.txt -X POST $BOOT/api/v1/search/text -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $TA" -d '{"schema_version":"1.0.0","query_text":"vay","k":101}')"
check "missing CSRF 403" 403 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/adm.txt -X POST $BOOT/api/v1/search/text -H 'Content-Type: application/json' -d '{"schema_version":"1.0.0","query_text":"vay","k":3}')"
curl -s -i -b $J/adm.txt -X POST $BOOT/api/v1/search/text -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $TA" -H 'X-Trace-Id: hdr-1' -d '{"schema_version":"1.0.0","query_text":"   ","k":3}' > $J/err.txt
grep -qi "cache-control: no-store" $J/err.txt && grep -qi "x-trace-id: hdr-1" $J/err.txt && { log "PASS: error no-store+trace"; pass=$((pass+1)); } || { log "FAIL: error headers"; fail=$((fail+1)); }
# AI-down -> typed 503 no-store, then recovery (own PID only)
AIPID=$(tr -d '[:space:]' < /private/tmp/fasearch-real-pilot-ai.pid)
kill -STOP "$AIPID"
sleep 2
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -b $J/adm.txt -X POST $BOOT/api/v1/search/text -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $TA" -d '{"schema_version":"1.0.0","query_text":"vay","k":3}')
kill -CONT "$AIPID"
sleep 3
check "AI-down 503" 503 "$CODE"
check "recovery 200" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/adm.txt -X POST $BOOT/api/v1/search/text -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $TA" -d '{"schema_version":"1.0.0","query_text":"vay","k":3}')"
rm -rf $J
log "RESULT pass=$pass fail=$fail"
[[ $fail == 0 ]]
