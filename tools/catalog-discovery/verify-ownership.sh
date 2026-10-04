#!/usr/bin/env bash
# Negative ownership checks never signal a process or mutate task PID records.
set -euo pipefail
FASEARCH_LIFECYCLE_LIB_ONLY=1 source /private/tmp/fasearch-catalog-discovery/tools/catalog-discovery/lifecycle.sh
ai=$(cat "$AI_PID_FILE")
if owns_process "$ai" "uvicorn fasearch_ai.main:app" /private/tmp/unrelated-stack "$PY_EXE"; then
  echo 'FAIL: wrong cwd accepted'; exit 1
fi
echo 'PASS: matching argv with wrong cwd refused'
if owns_process "$ai" "uvicorn fasearch_ai.main:app" "$ROOT/ai" /bin/bash; then
  echo 'FAIL: wrong executable accepted'; exit 1
fi
echo 'PASS: matching cwd/argv with wrong executable refused'
if guard_listener "$ai" "$BOOT_PORT"; then
  echo 'FAIL: wrong listener accepted'; exit 1
fi
echo 'PASS: wrong listener refused'
test_record=$(mktemp /private/tmp/catalog-negative-pid.XXXXXX)
trap 'rm -f "$test_record" "$test_record.identity"' EXIT
printf '%s\n' "$ai" > "$test_record"
printf '%s\n' 'impossible stale start identity' > "$test_record.identity"
if guard_pid "$test_record" "uvicorn fasearch_ai.main:app" "$ROOT/ai" "$PY_EXE"; then
  echo 'FAIL: stale PID identity accepted'; exit 1
fi
echo 'PASS: stale PID start identity refused'
check_stack
echo 'RESULT: negative ownership guards PASS; no signals sent'
