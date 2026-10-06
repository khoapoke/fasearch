#!/bin/bash
# Controlled lifecycle for the Account milestone preview services ONLY:
#   acct-be  BE 127.0.0.1:18480 (branch jar, scratch DB fasearch_acctest)
#   acct-fe  FE 127.0.0.1:3240  (dev on branch sources, backend 18480)
# Shared runtime (FE 3230, BE 18380, AI 18031, fasearch-postgres/storage) is
# OBSERVE-ONLY: this script never kills, restarts, rebuilds, or reconfigures it.
# It also never runs builds inside the shared fe/ tree (that wipes .next and
# breaks FE 3230 client JS); use build-isolated (separate output dir) instead.
#
# Usage: preview-lifecycle.sh {status|start|stop|restart|build-isolated} [acct-be|acct-fe]
# Guards: exact PID identity (cmdline + cwd + exe) and listener ownership are
# verified before any signal; occupied ports and mismatches REFUSE with exit 2.
set -u

ROOT="/private/tmp/fasearch-catalog-discovery"
BE_PORT=18480
FE_PORT=3240
BE_ENV_FILE="/tmp/acctest-be.env"

fail() { echo "REFUSE: $1" >&2; exit 2; }
info() { echo "$1"; }

listener_pid() { # port -> pid or empty
  lsof -Pan -i TCP:"$1" -sTCP:LISTEN 2>/dev/null | awk 'NR==2{print $2}'
}

proc_cmd() { ps -o command= -p "$1" 2>/dev/null; }
proc_cwd() { lsof -Pan -p "$1" 2>/dev/null | awk '$4=="cwd"{print $NF; exit}'; }

expect_contains() { # value, needle, what
  case "$1" in *"$2"*) ;; *) fail "$3 mismatch (got: $1)";; esac
}

# ---- per-service guards (identity verified, never assumed) ----
check_be() { # prints pid or ABSENT; fails on mismatch
  local pid; pid="$(listener_pid $BE_PORT)"
  [ -z "$pid" ] && { echo "ABSENT"; return 0; }
  local cmd cwd; cmd="$(proc_cmd "$pid")"; cwd="$(proc_cwd "$pid")"
  expect_contains "$cmd" "backend-0.0.1-SNAPSHOT.jar" "acct-be cmdline (pid $pid)"
  [ "$cwd" = "$ROOT/be" ] || fail "acct-be cwd (pid $pid, got: $cwd)"
  echo "$pid"
}

check_fe() { # prints pid or ABSENT; fails on mismatch
  local pid; pid="$(listener_pid $FE_PORT)"
  [ -z "$pid" ] && { echo "ABSENT"; return 0; }
  local cmd cwd; cmd="$(proc_cmd "$pid")"; cwd="$(proc_cwd "$pid")"
  expect_contains "$cmd" "next" "acct-fe cmdline (pid $pid)"
  [ "$cwd" = "$ROOT/fe" ] || fail "acct-fe cwd (pid $pid, got: $cwd)"
  echo "$pid"
}

# Fully-detached background start. The subshell rebinds ALL of its own std
# fds off the caller pipe and then execs the service (same PID, no lingering
# intermediate bash). macOS has no setsid here, so process-group detachment is
# NOT claimed: Ctrl-C on the caller group may still reach the service.
daemonize() { # log dir cmd...
  [ $# -ge 3 ] || { echo "daemonize usage: log dir cmd..." >&2; return 2; }
  local log="$1" dir="$2"; shift 2
  ( cd "$dir" || exit 1
    exec </dev/null >>"$log" 2>&1
    exec "$@" ) &
  echo "daemonize pid=$!"
}

svc_status() {
  local which="$1" out;
  if [ "$which" = "acct-be" ]; then out="$(check_be)"
    info "acct-be port=$BE_PORT pid=$out cwd=$ROOT/be"
    [ "$out" != "ABSENT" ] && curl -s -o /dev/null -w "health=%{http_code}\n" \
      --max-time 8 "http://127.0.0.1:$BE_PORT/actuator/health"
  else out="$(check_fe)"
    info "acct-fe port=$FE_PORT pid=$out cwd=$ROOT/fe"
    [ "$out" != "ABSENT" ] && curl -s -o /dev/null -w "page=%{http_code}\n" \
      --max-time 8 "http://127.0.0.1:$FE_PORT/dang-ky"
  fi
}

svc_stop() {
  local which="$1" pid;
  if [ "$which" = "acct-be" ]; then pid="$(check_be)"; else pid="$(check_fe)"; fi
  [ "$pid" = "ABSENT" ] && { info "$which already stopped"; return 0; }
  kill "$pid" || fail "kill $pid"
  for _ in $(seq 1 10); do
    sleep 1
    if [ "$which" = "acct-be" ]; then [ "$(check_be)" = "ABSENT" ] && break
    else [ "$(check_fe)" = "ABSENT" ] && break; fi
  done
  if [ "$which" = "acct-be" ]; then [ "$(check_be)" = "ABSENT" ] || fail "$which still listening"
  else [ "$(check_fe)" = "ABSENT" ] || fail "$which still listening"; fi
  info "$which stopped (pid $pid)"
}

svc_start() {
  local which="$1" pid;
  if [ "$which" = "acct-be" ]; then pid="$(check_be)"
  else pid="$(check_fe)"; fi
  [ "$pid" != "ABSENT" ] && fail "$which port occupied (pid $pid) — stop it first, no freeport kill"
  if [ "$which" = "acct-be" ]; then
    [ -f "$BE_ENV_FILE" ] || fail "missing BE env file $BE_ENV_FILE"
    set -a; . "$BE_ENV_FILE"; set +a
    daemonize /tmp/acctest-be.log "$ROOT/be" \
      java -jar target/backend-0.0.1-SNAPSHOT.jar
    for _ in $(seq 1 12); do
      sleep 5
      code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
        "http://127.0.0.1:$BE_PORT/actuator/health" || true)"
      [ "$code" = "200" ] && break
    done
    pid="$(check_be)"; [ "$pid" = "ABSENT" ] && fail "acct-be failed to listen"
    info "acct-be started pid=$pid"
  else
    export FASEARCH_BACKEND_URL="http://127.0.0.1:$BE_PORT"
    daemonize /tmp/acctest-fe.log "$ROOT/fe" npm run dev -- --port "$FE_PORT"
    for _ in $(seq 1 12); do
      sleep 5
      code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
        "http://127.0.0.1:$FE_PORT/dang-ky" || true)"
      [ "$code" = "200" ] && break
    done
    pid="$(check_fe)"; [ "$pid" = "ABSENT" ] && fail "acct-fe failed to listen"
    info "acct-fe started pid=$pid"
  fi
}

# Isolated production-equivalent build: exact HEAD snapshot into a separate
# directory with its own .next (never the shared tree). Needs a real
# node_modules copy (slow, disk-heavy); used only when a prod preview is
# explicitly required. Does NOT stash/switch/rebuild the shared checkout.
build_isolated() {
  [ $# -ge 1 ] || usage
  local dest="$1"
  [ -e "$dest" ] && fail "dest exists: $dest"
  mkdir -p "$dest" || fail "mkdir $dest"
  (cd "$ROOT" && git archive HEAD fe | tar -x -C "$dest") || fail "git archive"
  cp -r "$ROOT/fe/node_modules" "$dest/fe/node_modules" || fail "node_modules copy"
  (cd "$dest/fe" && npm run build) || fail "isolated build"
  info "isolated build OK at $dest/fe (own .next, shared tree untouched)"
}

usage() { echo "usage: $0 status|start|stop|restart|build-isolated [svc] [dest]" >&2; exit 2; }

main() {
  [ $# -ge 1 ] || usage
  local action="$1"
  local which="all"
  [ $# -ge 2 ] && which="$2"
  case "$action" in
    status)
      info "== shared (observe-only) =="
      for p in 3230 18380 18031 55732; do
        printf "port %s listener=%s\n" "$p" "$(listener_pid "$p")"
      done
      info "== account preview =="
      if [ "$which" = "all" ]; then svc_status acct-be; svc_status acct-fe
      else svc_status "$which"; fi
      ;;
    stop)
      [ "$which" = "all" ] && fail "refusing blanket stop; name acct-be or acct-fe"
      svc_stop "$which"
      ;;
    start)
      [ "$which" = "all" ] && fail "refusing blanket start; name acct-be or acct-fe"
      svc_start "$which"
      ;;
    restart)
      [ "$which" = "all" ] && fail "refusing blanket restart; name acct-be or acct-fe"
      svc_stop "$which"; svc_start "$which"
      ;;
    build-isolated) [ $# -ge 2 ] || usage; build_isolated "$2" ;;
    *) fail "unknown action $action" ;;
  esac
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
