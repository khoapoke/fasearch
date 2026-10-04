#!/usr/bin/env bash
# Integrated evidence runner: 3-mode search + draft lifecycle on the task stack.
# Non-destructive except disposable task data. Usage: verify-e2e.sh <out.log>
# Env required: TASK_ADMIN_PASS (bootstrap admin password). Never echoes secrets.
set -uo pipefail
umask 077
OUT="${1:-/tmp/verify-e2e.log}"
AI=http://127.0.0.1:18011; BOOT=http://127.0.0.1:18180; FE=http://127.0.0.1:3210
PASS_W="${TASK_ADMIN_PASS:?Set TASK_ADMIN_PASS}"
: > "$OUT"
pass=0; fail=0
log() { echo "$@" | tee -a "$OUT"; }
check() { if [[ "$2" == "$3" ]]; then pass=$((pass+1)); log "PASS: $1 (=$3)"; else fail=$((fail+1)); log "FAIL: $1 expected=$2 actual=$3"; fi; }
J=/tmp/e2e-cookies; mkdir -p $J; chmod 700 $J

log "== HEAD =="; git -C /private/tmp/fasearch-core-search-integration-2h rev-parse HEAD | tee -a "$OUT"

log "== 0. health =="
check "AI health" 200 "$(curl -s -o /dev/null -w '%{http_code}' $AI/internal/v1/health)"
check "Boot health" 200 "$(curl -s -o /dev/null -w '%{http_code}' $BOOT/actuator/health)"
check "FE home" 200 "$(curl -s -o /dev/null -w '%{http_code}' $FE/)"

# CSRF sessions: admin + anonymous guest
curl -s -c $J/adm.txt $BOOT/api/v1/auth/csrf > $J/c0.json
T0=$(python3 -c "import json;print(json.load(open('$J/c0.json'))['token'])")
check "admin login" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/adm.txt -c $J/adm.txt -X POST $BOOT/api/v1/auth/login -H "X-CSRF-TOKEN: $T0" --data-urlencode "username=task-admin" --data-urlencode "password=$PASS_W")"
TA=$(curl -s -b $J/adm.txt $BOOT/api/v1/auth/csrf | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])")
curl -s -c $J/g.txt $FE/api/auth/csrf > $J/cg.json
HN=$(python3 -c "import json;print(json.load(open('$J/cg.json'))['header_name'])")
TK=$(python3 -c "import json;print(json.load(open('$J/cg.json'))['token'])")

log "== 1. TEXT parity AI->Boot->Next =="
AI_TX=$(curl -s -X POST $AI/internal/v1/search/text -H 'Content-Type: application/json' -H 'X-Trace-Id: par-1' -d '{"schema_version":"1.0.0","query_text":"váy đỏ","k":3,"trace_id":"par-1","catalog_snapshot_id":"core-search-task-fixture-v1","model_version":"fixture-v1+4eaad46f9361","index_version":"api-prototype-index-v1"}')
echo "$AI_TX" > $J/ai.json
BT_TX=$(curl -s -b $J/adm.txt -X POST $BOOT/api/v1/search/text -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $TA" -H 'X-Trace-Id: par-1' -d '{"schema_version":"1.0.0","query_text":"váy đỏ","k":3}')
echo "$BT_TX" > $J/boot.json
NX_TX=$(curl -s -b $J/g.txt -X POST $FE/api/search/text -H 'Content-Type: application/json' -H "$HN: $TK" -H 'X-Trace-Id: par-1' -d '{"schema_version":"1.0.0","query_text":"váy đỏ","k":3}')
echo "$NX_TX" > $J/next.json
python3 - "$J/ai.json" "$J/boot.json" "$J/next.json" >> "$OUT" <<'PY'
import json,sys
ai=json.load(open(sys.argv[1])); bo=json.load(open(sys.argv[2])); nx=json.load(open(sys.argv[3]))
for name,d in (("ai",ai),("boot",bo),("next",nx)):
    assert d["mode"]=="TEXT",name
ids=lambda d:[(r["product_id"],r.get("product_version_id") or r.get("productVersionId"),r["rank"]) for r in d["results"]]
assert ids(ai)==ids(bo)==ids(nx), (ids(ai),ids(bo),ids(nx))
sa=[r["similarity_score"] for r in ai["results"]]; sb=[r.get("similarity_score",r.get("similarityScore")) for r in bo["results"]]
assert all(abs(a-b)<=1e-5 for a,b in zip(sa,sb)), (sa,sb)
assert bo["provenance"]["artifact_scope"]=="PILOT_ONLY" and ai["provenance"]["model_config_hash"]==bo["provenance"]["model_config_hash"]
assert "query_text" not in json.dumps(ai) and "image_path" not in json.dumps(ai)
print(f"PASS: TEXT parity order/count/scores<=1e-5/provenance/no-echo ({len(sa)} results)")
PY
[[ $? == 0 ]] && pass=$((pass+1)) || fail=$((fail+1))
# short + empty
check "TEXT short k=1 count" 1 "$(curl -s -b $J/adm.txt -X POST $BOOT/api/v1/search/text -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $TA" -d '{"schema_version":"1.0.0","query_text":"a","k":1}' | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["results"]))')"
check "TEXT empty gibberish" 200 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/adm.txt -X POST $BOOT/api/v1/search/text -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $TA" -d '{"schema_version":"1.0.0","query_text":"zzzqqqxkcd","k":5}')"

log "== 2. IMAGE + COMPOSED live =="
/private/tmp/fasearch-ai-venv/bin/python -c "from PIL import Image; Image.new('RGB',(32,32),color=(10,200,60)).save('/tmp/e2e-q.png','PNG')" 2>/dev/null || python3 -c "from PIL import Image; Image.new('RGB',(32,32),color=(10,200,60)).save('/tmp/e2e-q.png','PNG')"
IMG_TX=$(curl -s -b $J/g.txt -F 'image=@/tmp/e2e-q.png;type=image/png' -F 'k=3' -H "$HN: $TK" $FE/api/search/image)
echo "$IMG_TX" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["mode"]=="IMAGE" and len(d["results"])>0; print("PASS: IMAGE live", len(d["results"]), "results")' >> "$OUT" && pass=$((pass+1)) || fail=$((fail+1))
CMP_TX=$(curl -s -b $J/adm.txt -X POST $BOOT/api/v1/search/composed -H "X-CSRF-TOKEN: $TA" -F 'schema_version=1.0.0' -F 'image=@/tmp/e2e-q.png;type=image/png' -F 'modification_text=đổi sang màu xanh' -F 'k=3' -D $J/h.txt)
echo "$CMP_TX" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["mode"]=="COMPOSED" and d["reference"]["type"]=="UPLOAD" and d["provenance"]["artifact_scope"]=="PILOT_ONLY"; print("PASS: COMPOSED live UPLOAD")' >> "$OUT" && pass=$((pass+1)) || fail=$((fail+1))
grep -qi "cache-control: no-store" $J/h.txt && grep -qi "x-trace-id" $J/h.txt && { log "PASS: COMPOSED no-store+trace"; pass=$((pass+1)); } || { log "FAIL: COMPOSED headers"; fail=$((fail+1)); }

log "== 3. negatives/privacy/headers =="
check "blank 400" 400 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/adm.txt -X POST $BOOT/api/v1/search/text -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $TA" -d '{"schema_version":"1.0.0","query_text":"   ","k":3}')"
check "overlong TEXT_TOO_LONG" "TEXT_TOO_LONG" "$(python3 -c "print('{\"schema_version\":\"1.0.0\",\"query_text\":\"'+'x'*1025+'\",\"k\":3}')" | { curl -s -b $J/adm.txt -X POST $BOOT/api/v1/search/text -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $TA" --data-binary @- | python3 -c 'import json,sys;print(json.load(sys.stdin)["code"])'; })"
check "badK INVALID_REQUEST" "INVALID_REQUEST" "$(curl -s -b $J/adm.txt -X POST $BOOT/api/v1/search/text -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $TA" -d '{"schema_version":"1.0.0","query_text":"váy","k":101}' | python3 -c 'import json,sys;print(json.load(sys.stdin)["code"])')"
check "unknown field" "INVALID_REQUEST" "$(curl -s -b $J/adm.txt -X POST $BOOT/api/v1/search/text -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $TA" -d '{"schema_version":"1.0.0","query_text":"váy","k":3,"model":"x"}' | python3 -c 'import json,sys;print(json.load(sys.stdin)["code"])')"
check "surrogate 400 typed" "INVALID_REQUEST" "$(printf '{"schema_version":"1.0.0","query_text":"\\ud800","k":3}' | curl -s -b $J/adm.txt -X POST $BOOT/api/v1/search/text -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $TA" --data-binary @- | python3 -c 'import json,sys;print(json.load(sys.stdin)["code"])')"
python3 -c "print('{\"schema_version\":\"1.0.0\",\"query_text\":\"'+'y'*17000+'\",\"k\":3}')" > $J/big.json
check "16KiB Boot 413" 413 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/adm.txt -X POST $BOOT/api/v1/search/text -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $TA" --data-binary @$J/big.json)"
check "16KiB Next 413" 413 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/g.txt -X POST $FE/api/search/text -H 'Content-Type: application/json' -H "$HN: $TK" --data-binary @$J/big.json)"
check "16KiB AI 413" 413 "$(curl -s -o /dev/null -w '%{http_code}' -X POST $AI/internal/v1/search/text -H 'Content-Type: application/json' -H 'X-Trace-Id: cap' --data-binary @$J/big.json)"
check "bad trace 400" 400 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/adm.txt -X POST $BOOT/api/v1/search/text -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $TA" -H 'X-Trace-Id: bad trace!!' -d '{"schema_version":"1.0.0","query_text":"váy","k":3}')"
check "mime mismatch 415" 415 "$(curl -s -o /dev/null -w '%{http_code}' -b $J/adm.txt -X POST $BOOT/api/v1/search/composed -H "X-CSRF-TOKEN: $TA" -F 'schema_version=1.0.0' -F 'image=@/tmp/e2e-q.png;type=image/jpeg' -F 'modification_text=đổi màu' -F 'k=3')"
check "internal pub mismatch 409" 409 "$(curl -s -o /dev/null -w '%{http_code}' -X POST $AI/internal/v1/search/text -H 'Content-Type: application/json' -H 'X-Trace-Id: mm' -d '{"schema_version":"1.0.0","query_text":"váy","k":2,"trace_id":"mm","catalog_snapshot_id":"wrong","model_version":"fixture-v1+4eaad46f9361","index_version":"api-prototype-index-v1"}')"
curl -s -i -b $J/adm.txt -X POST $BOOT/api/v1/search/text -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $TA" -H 'X-Trace-Id: hdr-1' -d '{"schema_version":"1.0.0","query_text":"   ","k":3}' > $J/err.txt
grep -qi "cache-control: no-store" $J/err.txt && grep -qi "x-trace-id: hdr-1" $J/err.txt && { log "PASS: error no-store+trace"; pass=$((pass+1)); } || { log "FAIL: error headers"; fail=$((fail+1)); }

log "== 4. swagger =="
curl -s -o $J/served.json -w 'served:%{http_code}\n' $BOOT/docs/openapi.json | tee -a "$OUT"
python3 -c "
s=open('$J/served.json').read(); c=open('/private/tmp/fasearch-core-search-integration-2h/contracts/public-api.openapi.json').read()
assert s==c, 'served differs'; print('PASS: swagger byte-equal canonical')" >> "$OUT" && pass=$((pass+1)) || fail=$((fail+1))

log "RESULT pass=$pass fail=$fail"
exit $fail
