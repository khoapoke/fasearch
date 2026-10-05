#!/usr/bin/env bash
# C6 read-only check: guest browse leaves DB counts unchanged; guest and an
# authenticated task-local test session read identical public data
# (trace-normalized). Prints only PASS/FAIL + counts, never credentials,
# sessions, or CSRF values.
# Usage: c6-readonly-check.sh [BOOT_PORT] ; needs infra/fasearch/.env + docker.
set -euo pipefail
BOOT=${1:-18380}
BASE="http://127.0.0.1:$BOOT"
FAIL=0
REPO_ROOT="/Users/khoado/Documents/ChatGPT/Graduate Bachelor"
ENV_FILE="$REPO_ROOT/infra/fasearch/.env"
U=$(grep "^FASEARCH_POSTGRES_USER=" "$ENV_FILE" | cut -d= -f2 | tr -d "'\"")
DB=$(grep "^FASEARCH_POSTGRES_DB=" "$ENV_FILE" | cut -d= -f2 | tr -d "'\"")
P=$(grep "^FASEARCH_POSTGRES_PASSWORD=" "$ENV_FILE" | cut -d= -f2 | tr -d "'\"")
SNAP_TABLES="user_accounts catalog_products product_versions product_images audit_events"

counts() {
  local q=""
  for t in $SNAP_TABLES; do q="$q SELECT '$t='||count(*) FROM $t UNION ALL"; done
  q="${q% UNION ALL}"
  docker exec -e PGPASSWORD="$P" fasearch-postgres psql -U "$U" -d "$DB" -tA -c "$q" | sort
}

check() { if eval "$2"; then echo "PASS: $1"; else echo "FAIL: $1"; FAIL=1; fi; }

echo "== counts before =="
BEFORE=$(counts); echo "$BEFORE"

JAR_G=$(mktemp /tmp/c6-guest.XXXXXX); JAR_A=$(mktemp /tmp/c6-auth.XXXXXX)
trap 'rm -f "$JAR_G" "$JAR_A"' EXIT

echo "== guest full browse (25 pages + 3 details) =="
for p in $(seq 1 25); do
  curl -s --max-time 15 -c "$JAR_G" -b "$JAR_G" "$BASE/api/v1/catalog/products?page=$p&size=24" > /dev/null
done
FIRST_PID=$(curl -s --max-time 10 "$BASE/api/v1/catalog/products?page=1&size=1" | python3 -c "import json,sys; print(json.load(sys.stdin)['items'][0]['product_id'])")
for pid in "$FIRST_PID" 10011 10425; do
  curl -s --max-time 10 -c "$JAR_G" -b "$JAR_G" "$BASE/api/v1/catalog/products/$pid" > /dev/null
done
echo "guest browse done (pid sample: $FIRST_PID + 10011 + 10425)"

echo "== counts after guest browse =="
AFTER_GUEST=$(counts); echo "$AFTER_GUEST"
check "db counts unchanged by guest browse" "[ \"\$BEFORE\" = \"\$AFTER_GUEST\" ]"

echo "== authenticated session (task-local test account) =="
# Spring form login + session CSRF: fetch token, post form fields.
CSRF_JSON=$(curl -s --max-time 10 -c "$JAR_A" -b "$JAR_A" "$BASE/api/v1/auth/csrf")
CSRF_H=$(echo "$CSRF_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin)['header_name'])")
CSRF_T=$(echo "$CSRF_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])")
LOGIN_HTTP=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" -b "$JAR_A" -c "$JAR_A" \
  -H "$CSRF_H: $CSRF_T" --data-urlencode "username=task-admin" \
  --data-urlencode "password=Task-Admin-Test-Pass-123" "$BASE/api/v1/auth/login" || true)
echo "login http status: $LOGIN_HTTP"
if [ "$LOGIN_HTTP" = "200" ]; then
  norm() { python3 -c "import json,sys; d=json.load(sys.stdin); d.pop('trace_id',None); print(json.dumps(d,sort_keys=True))" | md5sum | cut -d' ' -f1; }
  G1=$(curl -s --max-time 10 -b "$JAR_G" "$BASE/api/v1/catalog/products?page=2&size=24" | norm)
  A1=$(curl -s --max-time 10 -b "$JAR_A" "$BASE/api/v1/catalog/products?page=2&size=24" | norm)
  check "guest/auth list equality (trace-normalized)" "[ \"$G1\" = \"$A1\" ]"
  G2=$(curl -s --max-time 10 -b "$JAR_G" "$BASE/api/v1/catalog/products/10011" | norm)
  A2=$(curl -s --max-time 10 -b "$JAR_A" "$BASE/api/v1/catalog/products/10011" | norm)
  check "guest/auth detail equality (trace-normalized)" "[ \"$G2\" = \"$A2\" ]"
  ME=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" -b "$JAR_A" "$BASE/api/v1/auth/me" || true)
  check "session valid for /me (got $ME)" "[ \"$ME\" = 200 ]"
  CSRF2_JSON=$(curl -s --max-time 10 -b "$JAR_A" -c "$JAR_A" "$BASE/api/v1/auth/csrf")
  CSRF2_H=$(echo "$CSRF2_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin)['header_name'])")
  CSRF2_T=$(echo "$CSRF2_JSON" | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])")
  curl -s --max-time 10 -b "$JAR_A" -c "$JAR_A" -H "$CSRF2_H: $CSRF2_T" \
    -X POST "$BASE/api/v1/auth/logout" > /dev/null || true
  ME2=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" -b "$JAR_A" "$BASE/api/v1/auth/me" || true)
  check "logout destroys session (me=$ME2)" "[ \"$ME2\" != 200 ]"
else
  echo "SKIP: task-local login unavailable on this Boot instance (http=$LOGIN_HTTP); recording as blocker, not evidence"
  FAIL=1
fi

echo "== counts final =="
AFTER_ALL=$(counts); echo "$AFTER_ALL"
check "db counts unchanged overall" "[ \"\$BEFORE\" = \"\$AFTER_ALL\" ]"

[ "$FAIL" = 0 ] && echo "RESULT: C6 READ-ONLY CHECKS PASS" || echo "RESULT: C6 CHECKS FAILED/BLOCKED"
exit "$FAIL"
