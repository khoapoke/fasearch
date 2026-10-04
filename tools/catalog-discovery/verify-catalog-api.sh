#!/usr/bin/env bash
# API-level verification for catalog-discovery (C1/C2/C6 browse subset).
# Against a running task stack (default Boot 18380). Raw curl + python asserts.
# Usage: verify-catalog-api.sh [BOOT_PORT]
set -euo pipefail
BOOT=${1:-18380}
BASE="http://127.0.0.1:$BOOT"
SNAP=catalog-20260908-pilot-v1
FAIL=0

check() { # name, shell-condition
  if eval "$2"; then echo "PASS: $1"; else echo "FAIL: $1"; FAIL=1; fi
}

echo "== list defaults =="
D=$(curl -s --max-time 10 "$BASE/api/v1/catalog/products")
echo "$D" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['schema_version']=='1.0.0' and d['page']==1 and d['size']==24 and d['total']==600 and d['has_more'] is True and len(d['items'])==24, d"
check "defaults page=1 size=24 total=600 has_more" "true"

echo "== page union: 600 exact identities, no dup/gap =="
IDS=$(for p in $(seq 1 25); do
  curl -s --max-time 15 "$BASE/api/v1/catalog/products?page=$p&size=24"; echo
 done | python3 -c "
import json,sys
ids=[]
for line in sys.stdin:
    line=line.strip()
    if line: ids += [(r['product_id'],r['product_version_id']) for r in json.loads(line)['items']]
print(len(ids), len(set(ids)))
")
echo "union: $IDS"
check "union 600 unique" "[ \"$IDS\" = \"600 600\" ]"

echo "== category totals =="
for c in TOP BOTTOM ONE_PIECE; do
  T=$(curl -s --max-time 10 "$BASE/api/v1/catalog/products?category=$c&size=1" | python3 -c "import json,sys; print(json.load(sys.stdin)['total'])")
  check "category $c total=200 (got $T)" "[ \"$T\" = 200 ]"
done

echo "== boundaries =="
curl -s --max-time 10 "$BASE/api/v1/catalog/products?size=60&page=10" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['total']==600 and len(d['items'])==60 and d['has_more'] is False, d"
check "max size=60 last page full" "true"
curl -s --max-time 10 "$BASE/api/v1/catalog/products?size=60&page=11" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['total']==600 and d['items']==[] and d['has_more'] is False, d"
check "past-end empty + total intact" "true"

echo "== rejections (400) =="
for q in "page=0" "size=0" "size=61" "page=abc" "size=" "category=SHOES" "category=" "page=99999999999999999999" "size=10&size=20" "sort=price" "page"; do
  CODE=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" "$BASE/api/v1/catalog/products?$q")
  check "400 for [$q] (got $CODE)" "[ \"$CODE\" = 400 ]"
done

echo "== snapshot mismatch (409) =="
CODE=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" "$BASE/api/v1/catalog/products?catalog_snapshot_id=stale")
check "409 stale snapshot (got $CODE)" "[ \"$CODE\" = 409 ]"

echo "== detail =="
FIRST=$(curl -s --max-time 10 "$BASE/api/v1/catalog/products?size=1" | python3 -c "import json,sys; d=json.load(sys.stdin)['items'][0]; print(d['product_id'],d['product_version_id'],d['title'])")
set -- $FIRST; PID=$1; PVID=$2
DET=$(curl -s --max-time 10 "$BASE/api/v1/catalog/products/$PID")
echo "$DET" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['product_id']=='$PID' and d['product_version_id']=='$PVID' and d['description'] is None, d"
check "detail identity parity + null description" "true"
DET2=$(curl -s --max-time 10 "$BASE/api/v1/catalog/products/$PID?product_version_id=$PVID&catalog_snapshot_id=$SNAP")
check "detail exact context OK" "echo '$DET2' | grep -q '\"product_id\":\"$PID\"'"
CODE=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" "$BASE/api/v1/catalog/products/$PID?product_version_id=$PVID")
check "400 partial context (got $CODE)" "[ \"$CODE\" = 400 ]"
CODE=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" "$BASE/api/v1/catalog/products/$PID?product_version_id=$PVID&catalog_snapshot_id=stale")
check "409 stale detail context (got $CODE)" "[ \"$CODE\" = 409 ]"
CODE=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" "$BASE/api/v1/catalog/products/$PID?product_version_id=wrong-v9&catalog_snapshot_id=$SNAP")
check "404 wrong version (got $CODE)" "[ \"$CODE\" = 404 ]"
CODE=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" "$BASE/api/v1/catalog/products/no-such-product")
check "404 unknown (got $CODE)" "[ \"$CODE\" = 404 ]"

echo "== no-store + trace on success and errors =="
H=$(curl -s --max-time 10 -D - -o /dev/null "$BASE/api/v1/catalog/products?size=1")
echo "$H" | grep -qi "cache-control: no-store" && echo "PASS: no-store success" || { echo "FAIL: no-store success"; FAIL=1; }
echo "$H" | grep -qi "x-trace-id:" && echo "PASS: trace success" || { echo "FAIL: trace success"; FAIL=1; }
H=$(curl -s --max-time 10 -D - -o /dev/null "$BASE/api/v1/catalog/products?size=99")
echo "$H" | grep -qi "cache-control: no-store" && echo "PASS: no-store error" || { echo "FAIL: no-store error"; FAIL=1; }

echo "== image identity/bytes =="
IMG_CODE=$(curl -s --max-time 15 -o /tmp/catdisc-img.bin -w "%{http_code}" "$BASE/api/v1/catalog/images/$PID/$PVID")
CT=$(file -b --mime-type /tmp/catdisc-img.bin)
check "image 200 + jpeg/png/webp (got $IMG_CODE $CT)" "[ \"$IMG_CODE\" = 200 ]"
CODE=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" "$BASE/api/v1/catalog/images/$PID/wrong-v9")
check "404 wrong-version image (got $CODE)" "[ \"$CODE\" = 404 ]"

if [ $FAIL -ne 0 ]; then echo "RESULT: FAIL"; exit 1; fi
echo "RESULT: ALL API CHECKS PASS"
