#!/bin/bash
# Regression: caller pipe must not stay open after a background service start.
# Phase 1 (RED on the old inline pattern): copies the buggy backgrounding
# verbatim; the caller pipeline must still be alive at the bound.
# Phase 2 (GREEN on the shipped helper): sources preview-lifecycle.sh and calls
# the real daemonize(); caller must return within bound, service detached.
#
# Dummy = task-owned 127.0.0.1 python http.server on an isolated test port.
# No shared services touched. Cleanup kills ONLY exact verified PIDs.
set -u

TAG="acct-detach-dummy"
pick_test_port() { # echo first free port from candidates, else fail
  local p
  for p in 34999 35099 35199; do
    if [ -z "$(lsof -Pan -i TCP:$p -sTCP:LISTEN 2>/dev/null | awk 'NR==2{print $2}')" ]; then
      echo "$p"
      return 0
    fi
  done
  return 1
}
TEST_PORT="$(pick_test_port)" || { echo "REGRESSION FAIL: no free test port" >&2; exit 1; }
OLD_LOG="/tmp/acct-detach-old.log"
BOUND=12

fail() { echo "REGRESSION FAIL: $1" >&2; exit 1; }
pass() { echo "REGRESSION PASS: $1"; }

port_free() {
  [ -z "$(lsof -Pan -i TCP:$TEST_PORT -sTCP:LISTEN 2>/dev/null | awk 'NR==2{print $2}')" ]
}

kill_exact() { # pid, marker
  local pid="$1" marker="$2"
  [ -z "$pid" ] && return 0
  local cmd; cmd="$(ps -o command= -p "$pid" 2>/dev/null || true)"
  case "$cmd" in
    *"$marker"*) kill "$pid" 2>/dev/null || true;;
    *) echo "skip kill pid=$pid (cmdline mismatch)" >&2;;
  esac
}

phase_old_red() {
  # Faithful to the production hang: the leaf spawns the long-runner as a
  # CHILD (like npm spawns node), so the list-runner bash survives holding
  # the caller pipe. Short-lived dummy (45s) self-cleans worst case.
  local mark="acct-detach-old-$$"
  rm -f "$OLD_LOG" /tmp/acct-detach-old.out
  ( (cd /tmp && bash -c "sleep 45 # $mark" > "$OLD_LOG" 2>&1 &); echo CALLER_DONE ) 2>&1 \
    | tail -n 5 > /tmp/acct-detach-old.out &
  local pipe_pid=$!
  sleep "$BOUND"
  if kill -0 "$pipe_pid" 2>/dev/null; then
    echo "old-pattern caller still alive at ${BOUND}s (pipe held open) — BUG reproduced"
    kill "$pipe_pid" 2>/dev/null || true
    sleep 1
    local leaf; leaf="$(pgrep -f "$mark" | head -n 1)"
    if [ -n "$leaf" ]; then
      local runner; runner="$(ps -o ppid= -p "$leaf" 2>/dev/null | tr -d ' ')"
      local rcmd; rcmd="$(ps -o command= -p "$runner" 2>/dev/null || true)"
      case "$runner" in
        ""|"$$") ;;
        *) case "$rcmd" in *test-lifecycle-detach.sh*) kill "$runner" 2>/dev/null || true;; esac ;;
      esac
      kill_exact "$leaf" "$mark"
    fi
    rm -f /tmp/acct-detach-old.out
    return 0  # red reproduced as expected
  else
    fail "old pattern returned within bound — no bug to fix?"
  fi
}

phase_new_green() {
  port_free || fail "test port $TEST_PORT occupied, refusing"
  # shellcheck disable=SC1091
  . "/private/tmp/fasearch-catalog-discovery/tools/account-completion/preview-lifecycle.sh"
  rm -f /tmp/acct-detach-new.log
  local t0 t1 dt
  t0="$(date +%s)"
  ( daemonize /tmp/acct-detach-new.log /tmp \
      python3 -m http.server "$TEST_PORT" --bind 127.0.0.1
    echo CALLER_DONE ) 2>&1 | tail -n 5 > /tmp/acct-detach-new.out
  t1="$(date +%s)"; dt=$((t1 - t0))
  grep -q CALLER_DONE /tmp/acct-detach-new.out \
    || fail "caller output incomplete (dt=${dt}s)"
  [ "$dt" -le "$BOUND" ] || fail "caller took ${dt}s (> ${BOUND}s)"
  local pid; pid="$(grep -o 'daemonize pid=[0-9]*' /tmp/acct-detach-new.out \
    | grep -o '[0-9]*' || true)"
  [ -n "$pid" ] || fail "no daemonize pid captured"
  trap "kill $pid 2>/dev/null || true" RETURN
  local listener=""
  for _ in $(seq 1 15); do
    listener="$(lsof -Pan -i TCP:$TEST_PORT -sTCP:LISTEN 2>/dev/null \
      | awk 'NR==2{print $2}')"
    [ -n "$listener" ] && break
    sleep 1
  done
  [ "$listener" = "$pid" ] \
    || fail "listener pid ($listener) != service pid ($pid)"
  local code; code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
    "http://127.0.0.1:$TEST_PORT/" || true)"
  [ "$code" = "200" ] || fail "dummy not serving (http $code)"
  # Identity by construction: this PID was just spawned by daemonize above
  # and is the sole listener on our probed test port.
  kill "$pid" 2>/dev/null || fail "kill service pid=$pid"
  sleep 1
  kill -0 "$pid" 2>/dev/null && fail "dummy still alive after guarded kill"
  trap - RETURN
  port_free || fail "test port still held after cleanup"
  rm -f /tmp/acct-detach-new.out
  pass "caller returned in ${dt}s; pid=$pid == listener; 127.0.0.1:200; cleaned"
}

case "${1:-both}" in
  old) phase_old_red ;;
  new) phase_new_green ;;
  both) phase_old_red; phase_new_green ;;
  *) echo "usage: $0 [old|new|both]" >&2; exit 2 ;;
esac
