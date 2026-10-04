#!/usr/bin/env bash
# Task-owned lifecycle for catalog-discovery (executable, guarded).
# Real frozen HF CLIP + 600-product bundle on isolated loopback stack.
# Usage: lifecycle.sh {start|stop|health|warm|restart} (run from any cwd)
# Never touches ports 3210/3220/18180/18011/18080/8001 or unknown PIDs.
set -euo pipefail

TASK=catalog-discovery
ROOT=/private/tmp/fasearch-catalog-discovery
ASSET_ROOT="/Users/khoado/Documents/ChatGPT/Graduate Bachelor"
AI_PORT=18031; BOOT_PORT=18380; FE_PORT=3230
PG_PORT=55732; S3_PORT=38535
AI_PID_FILE=/private/tmp/fasearch-catalog-discovery-ai.pid
BOOT_PID_FILE=/private/tmp/fasearch-catalog-discovery-boot.pid
FE_PID_FILE=/private/tmp/fasearch-catalog-discovery-fe.pid
VENV312="/Users/khoado/Documents/ChatGPT/Graduate Bachelor/.venv/bin/python"
PUB_CATALOG=catalog-20260908-pilot-v1
PUB_MODEL="openai/clip-vit-base-patch32@092a3b7e3172+a6a0317b924b"
PUB_INDEX=faiss-flatip-week4-v1

expect_free() {
  if lsof -a -iTCP:$1 -sTCP:LISTEN 2>/dev/null | grep -q LISTEN; then
    echo "REFUSE: port $1 already held" >&2; return 1
  fi
}

NODE_EXE=$("$VENV312" -c 'import os,shutil; print(os.path.realpath(shutil.which("node")))')
JAVA_EXE="$(/usr/libexec/java_home -v 17)/bin/java"
PY_EXE=$("$VENV312" -c 'import os,sys; print(os.path.realpath(sys.executable))')

owns_process() { # PID, argv pattern, exact cwd, executable
  local pid=$1 pattern=$2 cwd=$3 exe=$4 args observed
  [[ $pid =~ ^[0-9]+$ ]] || { echo "REFUSE: invalid PID" >&2; return 1; }
  args=$(ps -p "$pid" -o args= 2>/dev/null) || return 1
  printf '%s' "$args" | grep -qE "$pattern" || { echo "REFUSE: command mismatch $pid" >&2; return 1; }
  observed=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null) || return 1
  printf '%s\n' "$observed" | grep -Fxq "n$cwd" || { echo "REFUSE: cwd mismatch $pid" >&2; return 1; }
  observed=$(lsof -a -p "$pid" -d txt -Fn 2>/dev/null) || return 1
  printf '%s\n' "$observed" | grep -Fxq "n$exe" || { echo "REFUSE: executable mismatch $pid" >&2; return 1; }
}

guard_pid() { # PID file, argv pattern, cwd, executable
  local pidfile=$1 pattern=$2 cwd=$3 exe=$4 pid recorded current
  [[ -f $pidfile ]] || { echo "REFUSE: missing PID record" >&2; return 1; }
  pid=$(tr -d '[:space:]' < "$pidfile")
  owns_process "$pid" "$pattern" "$cwd" "$exe" || return 1
  [[ -f $pidfile.identity ]] || { echo "REFUSE: missing start identity; adopt first" >&2; return 1; }
  recorded=$(cat "$pidfile.identity")
  current=$(ps -p "$pid" -o lstart=)
  [[ $recorded == "$current" ]] || { echo "REFUSE: PID reused $pid" >&2; return 1; }
  printf '%s' "$pid"
}

guard_listener() {
  local pid=$1 port=$2 listeners
  listeners=$(lsof -tiTCP:$port -sTCP:LISTEN 2>/dev/null) || return 1
  [[ $listeners == "$pid" ]] || { echo "REFUSE: listener mismatch on $port" >&2; return 1; }
}

is_descendant() {
  local child=$1 ancestor=$2 parent count=0
  while [[ $child =~ ^[0-9]+$ && $child -gt 1 && $count -lt 64 ]]; do
    [[ $child == "$ancestor" ]] && return 0
    parent=$(ps -p "$child" -o ppid= 2>/dev/null | tr -d '[:space:]') || return 1
    [[ $parent != "$child" ]] || return 1
    child=$parent; count=$((count+1))
  done
  return 1
}

record_pid() {
  printf '%s\n' "$2" > "$1"
  ps -p "$2" -o lstart= > "$1.identity"
}

adopt_stack() {
  local ai boot wrapper listener
  ai=$(cat "$AI_PID_FILE"); boot=$(cat "$BOOT_PID_FILE"); wrapper=$(cat "$FE_PID_FILE")
  owns_process "$ai" "uvicorn fasearch_ai.main:app.*--port $AI_PORT" "$ROOT/ai" "$PY_EXE"
  guard_listener "$ai" "$AI_PORT"
  owns_process "$boot" "java -jar target/backend-0.0.1-SNAPSHOT.jar" "$ROOT/be" "$JAVA_EXE"
  guard_listener "$boot" "$BOOT_PORT"
  listener=$(lsof -tiTCP:$FE_PORT -sTCP:LISTEN)
  owns_process "$listener" "next-server" "$ROOT/fe" "$NODE_EXE"
  if [[ $wrapper != "$listener" ]]; then
    # One-time adoption of the verified historical AND-list shell or npm wrapper.
    if ! owns_process "$wrapper" "npm run start" "$ROOT/fe" "$NODE_EXE"; then
      owns_process "$wrapper" "bash $ROOT/tools/catalog-discovery/lifecycle.sh start" "$ROOT/fe" "/bin/bash"
    fi
    is_descendant "$listener" "$wrapper" || { echo "REFUSE: FE listener not descendant" >&2; return 1; }
  fi
  record_pid "$AI_PID_FILE" "$ai"; record_pid "$BOOT_PID_FILE" "$boot"; record_pid "$FE_PID_FILE" "$listener"
  "$VENV312" "$ROOT/tools/catalog-discovery/container_guard.py" adopt
  echo "ADOPT PASS: exact cwd/executable/listener/starttime; FE descendant verified"
}

check_stack() {
  local ai boot fe
  ai=$(guard_pid "$AI_PID_FILE" "uvicorn fasearch_ai.main:app.*--port $AI_PORT" "$ROOT/ai" "$PY_EXE")
  boot=$(guard_pid "$BOOT_PID_FILE" "java -jar target/backend-0.0.1-SNAPSHOT.jar" "$ROOT/be" "$JAVA_EXE")
  fe=$(guard_pid "$FE_PID_FILE" "next-server" "$ROOT/fe" "$NODE_EXE")
  guard_listener "$ai" "$AI_PORT"; guard_listener "$boot" "$BOOT_PORT"; guard_listener "$fe" "$FE_PORT"
  "$VENV312" "$ROOT/tools/catalog-discovery/container_guard.py" check
  echo "GUARD PASS: AI=$ai Boot=$boot FE=$fe"
}

do_health() {
  local fail=0
  curl -s --max-time 5 http://127.0.0.1:$AI_PORT/internal/v1/health | grep -q '"status":"UP"' \
    && echo "AI $AI_PORT UP" || { echo "AI $AI_PORT DOWN"; fail=1; }
  curl -s --max-time 5 http://127.0.0.1:$BOOT_PORT/actuator/health | grep -q '"status":"UP"' \
    && echo "Boot $BOOT_PORT UP" || { echo "Boot $BOOT_PORT DOWN"; fail=1; }
  [[ $(curl -s --max-time 5 -o /dev/null -w "%{http_code}" http://127.0.0.1:$FE_PORT/) == 200 ]] \
    && echo "FE $FE_PORT UP" || { echo "FE $FE_PORT DOWN"; fail=1; }
  return $fail
}

do_warm() {
  local trace="warm-$(date +%s)"
  curl -s --max-time 60 -X POST http://127.0.0.1:$AI_PORT/internal/v1/search/text \
    -H 'Content-Type: application/json' -H "X-Trace-Id: $trace" \
    -d "{\"schema_version\":\"1.0.0\",\"query_text\":\"red dress\",\"k\":1,\"trace_id\":\"$trace\",\"catalog_snapshot_id\":\"$PUB_CATALOG\",\"model_version\":\"$PUB_MODEL\",\"index_version\":\"$PUB_INDEX\"}" \
    | grep -q '"mode":"TEXT"' && echo "WARM OK $trace" || { echo "WARM FAIL"; return 1; }
}

do_start() {
  expect_free $AI_PORT; expect_free $BOOT_PORT; expect_free $FE_PORT
  "$VENV312" "$ROOT/tools/catalog-discovery/container_guard.py" check
  docker start fasearch-$TASK-pg fasearch-$TASK-s3 >/dev/null
  for i in $(seq 1 30); do
    docker exec fasearch-$TASK-pg pg_isready -U fasearch >/dev/null 2>&1 && break; sleep 1
  done

  cd "$ROOT/ai"
  FASEARCH_CONFIG_PATH="$ASSET_ROOT/ai/configs/baseline.v1.yaml" \
  FASEARCH_INDEX_DIR="$ASSET_ROOT/artifacts/indexes/week4-baseline-20260908-v1" \
  FASEARCH_ENCODER=hf_clip \
  FASEARCH_CATALOG_SNAPSHOT_ID="$PUB_CATALOG" \
  HF_HOME="$ASSET_ROOT/.cache/huggingface" HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 \
  TOKENIZERS_PARALLELISM=false \
  PYTHONPATH="$ROOT/ai" \
  nohup "$VENV312" -m uvicorn fasearch_ai.main:app --host 127.0.0.1 --port $AI_PORT \
    > /private/tmp/fasearch-catalog-discovery-ai.log 2>&1 &
  echo $! > $AI_PID_FILE

  cd "$ROOT/be"
  FASEARCH_DB_URL=jdbc:postgresql://127.0.0.1:$PG_PORT/fasearch FASEARCH_DB_USER=fasearch \
  FASEARCH_DB_PASSWORD=task-test-pw FASEARCH_OBJECT_ENDPOINT=http://127.0.0.1:$S3_PORT \
  FASEARCH_OBJECT_ACCESS_KEY=task-test-key FASEARCH_OBJECT_SECRET_KEY=task-test-secret \
  FASEARCH_AI_BASE_URL=http://127.0.0.1:$AI_PORT SERVER_PORT=$BOOT_PORT \
  FASEARCH_CATALOG_SNAPSHOT_ID="$PUB_CATALOG" \
  FASEARCH_MODEL_VERSION="$PUB_MODEL" FASEARCH_INDEX_VERSION="$PUB_INDEX" \
  FASEARCH_CATALOG_FILE="$ASSET_ROOT/data/processed/catalog-20260908-pilot-v1/catalog.cleaned.v1.jsonl" \
  FASEARCH_BOOTSTRAP_ADMIN_USERNAME=task-admin FASEARCH_BOOTSTRAP_ADMIN_EMAIL=task-admin@example.test \
  FASEARCH_BOOTSTRAP_ADMIN_PASSWORD=Task-Admin-Test-Pass-123 FASEARCH_COOKIE_SECURE=false \
  nohup java -jar target/backend-0.0.1-SNAPSHOT.jar \
    > /private/tmp/fasearch-catalog-discovery-boot.log 2>&1 &
  echo $! > $BOOT_PID_FILE

  cd "$ROOT/fe" || return 1
  FASEARCH_BACKEND_URL=http://127.0.0.1:$BOOT_PORT PORT=$FE_PORT \
    nohup npm run start -- --port $FE_PORT > /private/tmp/fasearch-catalog-discovery-fe.log 2>&1 &
  local wrapper=$!

  for i in $(seq 1 40); do do_health >/dev/null 2>&1 && break; sleep 3; done
  do_health
  local listener; listener=$(lsof -tiTCP:$FE_PORT -sTCP:LISTEN)
  owns_process "$listener" "next-server" "$ROOT/fe" "$NODE_EXE"
  is_descendant "$listener" "$wrapper" || { echo "REFUSE: FE listener not descendant" >&2; return 1; }
  record_pid "$AI_PID_FILE" "$(cat "$AI_PID_FILE")"
  record_pid "$BOOT_PID_FILE" "$(cat "$BOOT_PID_FILE")"
  record_pid "$FE_PID_FILE" "$listener"
  check_stack
}

do_stop() {
  # Validate the whole stack before the first signal. No process-group scan/kill.
  check_stack
  local pid
  for record in "$FE_PID_FILE" "$BOOT_PID_FILE" "$AI_PID_FILE"; do
    pid=$(cat "$record")
    kill "$pid"
    for i in $(seq 1 60); do
      kill -0 "$pid" 2>/dev/null || break
      sleep .5
    done
    kill -0 "$pid" 2>/dev/null && { echo "REFUSE: process still draining $pid" >&2; return 1; }
    rm "$record" "$record.identity"
    echo "STOPPED exact task PID $pid"
  done
  docker stop fasearch-$TASK-pg fasearch-$TASK-s3 >/dev/null
  echo "task containers stopped"
}

[[ ${FASEARCH_LIFECYCLE_LIB_ONLY:-0} == 1 ]] && return 0

case "${1:-}" in
  adopt) adopt_stack;; check) check_stack;;
  start) do_start;; stop) do_stop;; health) do_health;; warm) do_warm;;
  restart) do_stop; sleep 2; do_start;;
  *) echo "usage: lifecycle.sh {start|stop|health|warm|restart}" >&2; exit 2;;
esac
