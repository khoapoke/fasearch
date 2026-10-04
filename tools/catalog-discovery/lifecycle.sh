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

guard_pid() {
  local pidfile=$1 pattern=$2 pid
  [[ -f $pidfile ]] || { echo "REFUSE: missing pid file $pidfile" >&2; return 1; }
  pid=$(tr -d '[:space:]' < "$pidfile")
  [[ $pid =~ ^[0-9]+$ ]] || { echo "REFUSE: bad pid in $pidfile" >&2; return 1; }
  local args; args=$(ps -p "$pid" -o args= 2>/dev/null) || { echo "REFUSE: pid $pid not running" >&2; return 1; }
  if ! printf '%s' "$args" | grep -qE "$pattern"; then
    echo "REFUSE: pid $pid is not this task's process: $args" >&2; return 1
  fi
  printf '%s' "$pid"
}

guard_listener() {
  local pid=$1 port=$2
  lsof -a -p "$pid" -iTCP:$port -sTCP:LISTEN 2>/dev/null | grep -q LISTEN || { echo "REFUSE: pid $pid has no listener on $port" >&2; return 1; }
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

  ( cd "$ROOT/fe" && \
    FASEARCH_BACKEND_URL=http://127.0.0.1:$BOOT_PORT PORT=$FE_PORT \
    nohup npm run start -- --port $FE_PORT > /private/tmp/fasearch-catalog-discovery-fe.log 2>&1 & \
    echo $! > $FE_PID_FILE )

  for i in $(seq 1 40); do do_health >/dev/null 2>&1 && break; sleep 3; done
  do_health
}

do_stop() {
  local pid child
  if [[ -f $FE_PID_FILE ]]; then
    pid=$(guard_pid "$FE_PID_FILE" "npm run start|next-server") \
      || return 1
    child=""
    for candidate in $(pgrep -g "$(ps -o pgid= -p "$pid" | tr -d ' ')" 2>/dev/null); do
      if lsof -a -p "$candidate" -iTCP:$FE_PORT -sTCP:LISTEN 2>/dev/null | grep -q LISTEN; then
        child=$candidate
        break
      fi
    done
    if [[ -z $child ]]; then echo "REFUSE: no task listener on $FE_PORT" >&2; return 1; fi
    kill "$child" 2>/dev/null || true
    echo "stopped FE server $child (wrapper $pid)"
    sleep 2
    kill -0 "$pid" 2>/dev/null && kill "$pid" 2>/dev/null || true
  fi
  if [[ -f $BOOT_PID_FILE ]]; then
    pid=$(guard_pid "$BOOT_PID_FILE" "backend-0.0.1-SNAPSHOT.jar") \
    && guard_listener "$pid" "$BOOT_PORT" && kill "$pid" \
    && echo "stopped Boot $pid" || return 1
  fi
  if [[ -f $AI_PID_FILE ]]; then
    pid=$(guard_pid "$AI_PID_FILE" "uvicorn fasearch_ai.main:app.*--port $AI_PORT") \
    && guard_listener "$pid" "$AI_PORT" && kill "$pid" \
    && echo "stopped AI $pid" || return 1
  fi
  docker stop fasearch-$TASK-pg fasearch-$TASK-s3 >/dev/null
  echo "task containers stopped"
}

case "${1:-}" in
  start) do_start;; stop) do_stop;; health) do_health;; warm) do_warm;;
  restart) do_stop; sleep 2; do_start;;
  *) echo "usage: lifecycle.sh {start|stop|health|warm|restart}" >&2; exit 2;;
esac
