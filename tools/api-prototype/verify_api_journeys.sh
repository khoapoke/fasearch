#!/usr/bin/env bash
# API prototype journey verification (task-local, disposable backends).
# Usage: BASE=http://127.0.0.1:18080 FASEARCH_PROTO_ADMIN_USER=proto-admin ADMIN_PASS=... ./verify_api_journeys.sh
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:18080}"
FASEARCH_PROTO_USER="${FASEARCH_PROTO_ADMIN_USER:-proto-admin}"
PASS="${ADMIN_PASS:?Set ADMIN_PASS in environment (never commit it)}"
JAR_COOKIE=/private/tmp/fasearch-verify-cookies.txt
rm -f "$JAR_COOKIE"
# Task-owned AI service identity (exact-PID lifecycle; never pkill broad patterns).
FASEARCH_AI_PID_FILE="${FASEARCH_AI_PID_FILE:-/private/tmp/fasearch-ai-proto.pid}"
FASEARCH_AI_PORT="${FASEARCH_AI_PORT:-8001}"
FASEARCH_PY312="${FASEARCH_PY312:-/Users/khoado/Documents/ChatGPT/Graduate Bachelor/.venv/bin/python}"

fasearch_ai_pid() {
  # Prints the PID only if the PID file names a live process whose command
  # line is exactly this task's AI service; otherwise prints nothing.
  local pid
  [[ -f "$FASEARCH_AI_PID_FILE" ]] || return 0
  pid=$(tr -d '[:space:]' < "$FASEARCH_AI_PID_FILE")
  [[ "$pid" =~ ^[0-9]+$ ]] || return 0
  local args
  args=$(ps -p "$pid" -o args= 2>/dev/null) || return 0
  if printf '%s' "$args" | grep -qE "uvicorn fasearch_ai\.main:app.*--port ${FASEARCH_AI_PORT}( |$)"; then
    printf '%s' "$pid"
  fi
}

pass=0; fail=0
check() { # check <desc> <expected> <actual>
  if [[ "$2" == "$3" ]]; then pass=$((pass+1)); echo "PASS: $1 (=$3)";
  else fail=$((fail+1)); echo "FAIL: $1 (expected=$2 actual=$3)"; fi
}

echo "== 0. docs =="
DOCS_HTML=$(curl -s -o /private/tmp/fasearch-docs.html -w "%{http_code}" "$BASE/docs")
check "GET /docs" 200 "$DOCS_HTML"
grep -q "swagger-ui" /private/tmp/fasearch-docs.html && echo "PASS: swagger-ui referenced" && pass=$((pass+1)) || { echo "FAIL: swagger-ui missing"; fail=$((fail+1)); }
SPEC_CODE=$(curl -s -o /private/tmp/fasearch-served-openapi.json -w "%{http_code}" "$BASE/docs/openapi.json")
check "GET /docs/openapi.json" 200 "$SPEC_CODE"
python3 - <<"INNER_EOF"
import json
served = open('/private/tmp/fasearch-served-openapi.json').read()
canonical = open('/private/tmp/fasearch-api-prototype-3h/contracts/public-api.openapi.json').read()
assert served == canonical, "served contract differs from canonical"
d = json.loads(served)
ops = sum(1 for v in d['paths'].values() for m in ('get','post','put','patch','delete') if m in v)
assert (len(d['paths']), ops) == (9, 11), (len(d['paths']), ops)
print("PASS: served contract == canonical (9 paths / 11 ops)")
INNER_EOF
WEBJAR_JS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/webjars/swagger-ui/5.17.0/swagger-ui-bundle.js")
check "GET swagger-ui-bundle.js" 200 "$WEBJAR_JS"

echo "== 1. auth journey =="
CSRF_JSON=$(curl -s -c "$JAR_COOKIE" "$BASE/api/v1/auth/csrf")
TOKEN=$(python3 -c "import json,sys; print(json.load(open('/dev/stdin'))['token'])" <<<"$CSRF_JSON")
[[ -n "$TOKEN" ]] && echo "PASS: csrf token issued" && pass=$((pass+1)) || { echo "FAIL: empty csrf"; fail=$((fail+1)); }
LOGIN_CODE=$(curl -s -o /private/tmp/fasearch-login.json -w "%{http_code}" -c "$JAR_COOKIE" -b "$JAR_COOKIE" -X POST "$BASE/api/v1/auth/login" -H "X-CSRF-TOKEN: $TOKEN" --data-urlencode "username=$FASEARCH_PROTO_USER" --data-urlencode "password=$PASS")
check "POST login" 200 "$LOGIN_CODE"
ME_JSON=$(curl -s -b "$JAR_COOKIE" "$BASE/api/v1/auth/me")
python3 -c "import json; d=json.load(open('/dev/stdin')); assert d['username']=='$FASEARCH_PROTO_USER', d; print('PASS: me =', d['username'])" <<<"$ME_JSON" && pass=$((pass+1)) || { echo "FAIL: me"; fail=$((fail+1)); }

echo "== 2. denials =="
NOSESS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/catalog/admin/drafts" -H 'Content-Type: application/json' -d '{"title":"x","category":"TOP"}')
check "POST draft no session+csrf denied" 403 "$NOSESS"
FRESH_CSRF=$(curl -s -b "$JAR_COOKIE" "$BASE/api/v1/auth/csrf" | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
NOCSRF=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR_COOKIE" -X POST "$BASE/api/v1/catalog/admin/drafts" -H 'Content-Type: application/json' -d '{"title":"x","category":"TOP"}')
check "POST draft no csrf denied" 403 "$NOCSRF"

echo "== 3. draft journey =="
CREATED=$(curl -s -b "$JAR_COOKIE" -X POST "$BASE/api/v1/catalog/admin/drafts" -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $FRESH_CSRF" -d '{"title":"Áo prototype","category":"TOP"}' -D /private/tmp/fasearch-headers.txt)
LOCATION=$(grep -i '^location:' /private/tmp/fasearch-headers.txt | tr -d '\r' | awk '{print $2}')
echo "created: $LOCATION // $(head -c 200 <<<"$CREATED")"
[[ "$LOCATION" == /api/v1/catalog/admin/drafts/* ]] && pass=$((pass+1)) && echo "PASS: draft created" || { echo "FAIL: draft create"; fail=$((fail+1)); }
V1=$(python3 -c "import json; print(json.load(open('/dev/stdin'))['version_no'])" <<<"$CREATED")
check "draft version_no=1" 1 "$V1"
READ_JSON=$(curl -s -b "$JAR_COOKIE" "$BASE$LOCATION")
RV=$(python3 -c "import json,sys; print(json.load(sys.stdin)['version_no'])" <<<"$READ_JSON")
check "draft read version" 1 "$RV"
REVISED=$(curl -s -b "$JAR_COOKIE" -X PATCH "$BASE$LOCATION" -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $FRESH_CSRF" -d '{"title":"Áo prototype v2","category":"TOP","expected_version_no":1}')
V2=$(python3 -c "import json,sys; print(json.load(sys.stdin)['version_no'])" <<<"$REVISED")
check "draft revised version_no=2" 2 "$V2"
STALE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR_COOKIE" -X PATCH "$BASE$LOCATION" -H 'Content-Type: application/json' -H "X-CSRF-TOKEN: $FRESH_CSRF" -d '{"title":"stale","category":"TOP","expected_version_no":1}')
check "stale revision 409" 409 "$STALE"

echo "== 4. draft image upload/read =="
python3 -c "from PIL import Image; Image.new('RGB',(64,64),color=(10,200,120)).save('/private/tmp/fasearch-upload.png',format='PNG')" 2>/dev/null || python3 -c "import struct,zlib; d=b'\x89PNG\r\n\x1a\n'+b'....'; open('/private/tmp/fasearch-upload.png','wb').write(d)"
UP_JSON=$(curl -s -b "$JAR_COOKIE" -X POST "$BASE$LOCATION/image" -H "X-CSRF-TOKEN: $FRESH_CSRF" -F "image=@/private/tmp/fasearch-upload.png;type=image/png" -F "expected_version_no=2")
UV=$(python3 -c "import json,sys; d=json.load(sys.stdin); print(d['version_no'], d['has_primary_image'])" <<<"$UP_JSON")
check "image upload -> v3 + has image" "3 True" "$UV"
curl -s -b "$JAR_COOKIE" -o /private/tmp/fasearch-readback.png "$BASE$LOCATION/image"
if cmp -s /private/tmp/fasearch-upload.png /private/tmp/fasearch-readback.png; then echo "PASS: image bytes identical"; pass=$((pass+1)); else echo "FAIL: image bytes differ"; fail=$((fail+1)); fi
sha256sum /private/tmp/fasearch-upload.png /private/tmp/fasearch-readback.png | awk '{print $1}' | uniq -c

echo "== 5. public versioned image =="
PUB_CODE=$(curl -s -o /private/tmp/fasearch-pub.jpg -w "%{http_code}" "$BASE/api/v1/catalog/images/f1/f1-v1")
check "GET public f1/f1-v1" 200 "$PUB_CODE"
if cmp -s /private/tmp/fasearch-ai-fixture/images/f1.jpg /private/tmp/fasearch-pub.jpg; then echo "PASS: public image bytes identical"; pass=$((pass+1)); else echo "FAIL: public image bytes differ"; fail=$((fail+1)); fi
WRONG_VER=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/v1/catalog/images/f1/f1-v999")
check "GET wrong version 404" 404 "$WRONG_VER"

echo "== 6. image search =="
SEARCH_JSON=$(curl -s -X POST "$BASE/api/v1/search/image" -F "image=@/private/tmp/fasearch-ai-fixture/images/f1.jpg;type=image/jpeg" -F "k=3" -H "X-Trace-Id: proto-trace-1")
python3 - "$SEARCH_JSON" <<'EOF'
import json, sys
d = json.loads(sys.argv[1])
assert d["schema_version"] == "1.0.0", d
assert d["mode"] == "IMAGE", d
assert d["trace_id"] == "proto-trace-1", d
pub = d["publication"]
assert pub == {"catalog_snapshot_id": "api-prototype-fixture-v1",
               "model_version": "fixture-v1+4eaad46f9361",
               "index_version": "api-prototype-index-v1"}, pub
ranks = [r["rank"] for r in d["results"]]
assert ranks == sorted(ranks) and ranks[0] == 1, ranks
assert d["results"][0]["product_id"] == "f1", d["results"][0]
print("PASS: ranked results + provenance:", [(r["product_id"], round(r["similarity_score"], 3)) for r in d["results"]])
print("PASS: latency:", d["latency"])
EOF
[[ $? -eq 0 ]] && pass=$((pass+1)) || fail=$((fail+1))
BAD_IMG=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/search/image" -F "image=@/private/tmp/fasearch-api-prototype-3h/tools/api-prototype/verify_api_journeys.sh;type=text/plain" -F "k=3")
check "unsupported image type 415" 415 "$BAD_IMG"
BAD_IMG_BODY=$(curl -s -X POST "$BASE/api/v1/search/image" -F "image=@/private/tmp/fasearch-api-prototype-3h/tools/api-prototype/verify_api_journeys.sh;type=text/plain" -F "k=3")
python3 - "$BAD_IMG_BODY" <<'INNER_EOF'
import json, sys
d = json.loads(sys.argv[1])
assert (d["schema_version"], d["code"]) == ("1.0.0", "INVALID_IMAGE"), d
print("PASS: 415 error contract:", d["code"])
INNER_EOF
[[ $? -eq 0 ]] && pass=$((pass+1)) || fail=$((fail+1))
BAD_K=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/search/image" -F "image=@/private/tmp/fasearch-ai-fixture/images/f1.jpg;type=image/jpeg" -F "k=999")
check "bad k rejected" 400 "$BAD_K"

echo "== 6b. AI unavailable =="
AI_PID=$(fasearch_ai_pid)
if [[ -z "${AI_PID:-}" ]]; then
  echo "FAIL: AI PID file $FASEARCH_AI_PID_FILE does not name a live task-owned AI process; refusing to touch unknown processes"
  fail=$((fail+1))
else
  kill "$AI_PID"; sleep 2
  for i in $(seq 1 15); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:$FASEARCH_AI_PORT/internal/v1/health || break; sleep 1; done
  DOWN_JSON=$(curl -s -X POST "$BASE/api/v1/search/image" -F "image=@/private/tmp/fasearch-ai-fixture/images/f1.jpg;type=image/jpeg" -F "k=3" -w "\nHTTP:%{http_code}")
  DOWN_CODE=$(tail -1 <<<"$DOWN_JSON" | grep -o '[0-9]*')
  check "AI down -> 503" 503 "$DOWN_CODE"
  DOWN_BODY=$(sed '$d' <<<"$DOWN_JSON")
  python3 - "$DOWN_BODY" <<'INNER_EOF'
import json, sys
d = json.loads(sys.argv[1])
assert (d["schema_version"], d["code"]) == ("1.0.0", "AI_UNAVAILABLE"), d
print("PASS: 503 error contract:", d["code"])
INNER_EOF
  [[ $? -eq 0 ]] && pass=$((pass+1)) || fail=$((fail+1))
  PYTHONPATH=/private/tmp/fasearch-api-prototype-3h/ai FASEARCH_ENCODER=fixture \
    FASEARCH_CONFIG_PATH=/private/tmp/fasearch-api-prototype-3h/ai/configs/baseline.v1.yaml \
    FASEARCH_INDEX_DIR=/private/tmp/fasearch-ai-fixture/index \
    FASEARCH_CATALOG_SNAPSHOT_ID=api-prototype-fixture-v1 \
    nohup "$FASEARCH_PY312" -m uvicorn fasearch_ai.main:app \
    --host 127.0.0.1 --port "$FASEARCH_AI_PORT" > /private/tmp/fasearch-ai.log 2>&1 < /dev/null &
  echo $! > "$FASEARCH_AI_PID_FILE"
  for i in $(seq 1 10); do curl -s -o /dev/null --max-time 2 http://127.0.0.1:$FASEARCH_AI_PORT/internal/v1/health && break; sleep 2; done
  NEW_PID=$(fasearch_ai_pid)
  if [[ -z "${NEW_PID:-}" ]]; then echo "FAIL: restarted AI failed ownership check"; fail=$((fail+1)); else echo "PASS: AI restarted as task PID $NEW_PID"; pass=$((pass+1)); fi
  ps -p "$NEW_PID" -o args= | grep -q "Graduate Bachelor/.venv/bin/python" && { echo "PASS: AI runs under project Python 3.12 venv"; pass=$((pass+1)); } || { echo "FAIL: AI not on project venv"; fail=$((fail+1)); }
  RECOVER=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/search/image" -F "image=@/private/tmp/fasearch-ai-fixture/images/f1.jpg;type=image/jpeg" -F "k=1")
  check "AI recovered -> 200" 200 "$RECOVER"
fi

echo "== 7. logout =="
LOGOUT_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR_COOKIE" -c "$JAR_COOKIE" -X POST "$BASE/api/v1/auth/logout" -H "X-CSRF-TOKEN: $FRESH_CSRF")
check "POST logout" 204 "$LOGOUT_CODE"
AFTER_ME=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR_COOKIE" "$BASE/api/v1/auth/me")
check "me after logout denied" 401 "$AFTER_ME"

echo "== RESULT: pass=$pass fail=$fail =="
[[ $fail -eq 0 ]]
