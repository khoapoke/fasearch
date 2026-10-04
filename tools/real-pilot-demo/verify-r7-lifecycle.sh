#!/usr/bin/env bash
# R7: Repeatable isolated runtime. Executable guards, restart transcript, old stacks untouched.
set -uo pipefail
OUT="${1:-/tmp/rp-r7.log}"
: > "$OUT"
pass=0; fail=0
log(){ echo "$@" | tee -a "$OUT"; }
LC=/private/tmp/fasearch-real-pilot-integrated-demo/tools/real-pilot-demo/lifecycle.sh
log "== HEAD =="; git -C /private/tmp/fasearch-real-pilot-integrated-demo rev-parse HEAD | tee -a "$OUT"
[[ -x "$LC" ]] && { log "PASS: lifecycle executable"; pass=$((pass+1)); } || { log "FAIL: lifecycle not executable"; fail=$((fail+1)); }
for f in /private/tmp/fasearch-real-pilot-ai.pid /private/tmp/fasearch-real-pilot-boot.pid /private/tmp/fasearch-real-pilot-fe.pid; do
  PID=$(tr -d '[:space:]' < "$f" 2>/dev/null || echo "?")
  if [[ "$PID" =~ ^[0-9]+$ ]] && ps -p "$PID" > /dev/null; then log "PASS: $f pid $PID running"; pass=$((pass+1)); else log "FAIL: $f pid $PID"; fail=$((fail+1)); fi
done
# listener guards
(lsof -a -p "$(tr -d '[:space:]' < /private/tmp/fasearch-real-pilot-ai.pid)" -iTCP:18021 -sTCP:LISTEN 2>/dev/null | grep -q LISTEN && { log "PASS: AI listener 18021"; pass=$((pass+1)); } || { log "FAIL: AI listener"; fail=$((fail+1)); })
(lsof -a -p "$(tr -d '[:space:]' < /private/tmp/fasearch-real-pilot-boot.pid)" -iTCP:18280 -sTCP:LISTEN 2>/dev/null | grep -q LISTEN && { log "PASS: Boot listener 18280"; pass=$((pass+1)); } || { log "FAIL: Boot listener"; fail=$((fail+1)); })
# old stacks untouched
for P in 3210 18180 18011 18080 8001; do
  if lsof -iTCP:$P -sTCP:LISTEN 2>/dev/null | grep -q LISTEN; then log "PASS: old stack port $P still held"; pass=$((pass+1)); else log "FAIL: old stack port $P missing"; fail=$((fail+1)); fi
done
# restart transcript (raw sanitized)
{
  echo "=== stop ==="; bash "$LC" stop
  sleep 3
  echo "=== start ==="; bash "$LC" start
  echo "=== health ==="; bash "$LC" health
  echo "=== warm ==="; bash "$LC" warm
} > /tmp/rp-restart-transcript.log 2>&1
[[ $? == 0 ]] && { log "PASS: restart transcript"; pass=$((pass+1)); } || { log "FAIL: restart"; fail=$((fail+1)); }
log "restart transcript: /tmp/rp-restart-transcript.log"
cat /tmp/rp-restart-transcript.log >> "$OUT"
log "RESULT pass=$pass fail=$fail"
[[ $fail == 0 ]]
