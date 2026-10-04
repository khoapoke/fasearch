#!/usr/bin/env bash
# Task-owned lifecycle for core-search-integration-2h (executable, guarded).
# Usage: lifecycle.sh {start|stop|health}   (run from any cwd; cd is separate)
# Never touches ports 18080/8001 or unknown PIDs. Refuses loudly on mismatch.
set -euo pipefail

TASK=core-search-integration-2h
ROOT=/private/tmp/fasearch-core-search-integration-2h
AI_PORT=18011; BOOT_PORT=18180; FE_PORT=3210
PG_PORT=55532; S3_PORT=38335
AI_PID_FILE=/private/tmp/fasearch-core-search-2h-ai.pid
BOOT_PID_FILE=/private/tmp/fasearch-core-search-2h-boot.pid
FE_PID_FILE=/private/tmp/fasearch-core-search-2h-fe.pid
VENV312="/Users/khoado/Documents/ChatGPT/Graduate Bachelor/.venv/bin/python"

expect_free() { # expect_free <port>
  if lsof -a -iTCP:$1 -sTCP:LISTEN 2>/dev/null | grep -q LISTEN; then
    echo "REFUSE: port $1 already held by $(lsof -ti :"$1" | head -n 1)" >&2; return 1
  fi
}

guard_pid() { # guard_pid <pidfile> <pattern>
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

guard_listener() { # guard_listener <pid> <port>
  local pid=$1 port=$2
  lsof -a -p "$pid" -iTCP:$port -sTCP:LISTEN 2>/dev/null | grep -q LISTEN     || { echo "REFUSE: pid $pid has no listener on $port" >&2; return 1; }
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

do_start() {
  expect_free $AI_PORT; expect_free $BOOT_PORT; expect_free $FE_PORT
  docker start fasearch-$TASK-pg fasearch-$TASK-s3 >/dev/null
  for i in $(seq 1 30); do pg_isready -h 127.0.0.1 -p $PG_PORT -U fasearch >/dev/null 2>&1 && break; sleep 1; done

  cd "$ROOT/ai"
  FASEARCH_CONFIG_PATH=/private/tmp/fasearch-api-prototype-3h/ai/configs/baseline.v1.yaml \
  FASEARCH_INDEX_DIR=/private/tmp/fasearch-ai-fixture/index \
  FASEARCH_ENCODER=fixture \
  FASEARCH_CATALOG_SNAPSHOT_ID=core-search-task-fixture-v1 \
  PYTHONPATH="$ROOT/ai" \
  nohup "$VENV312" -m uvicorn fasearch_ai.main:app --host 127.0.0.1 --port $AI_PORT \
    > /private/tmp/fasearch-core-search-2h-ai.log 2>&1 &
  echo $! > $AI_PID_FILE

  cd "$ROOT/be"
  FASEARCH_DB_URL=jdbc:postgresql://127.0.0.1:$PG_PORT/fasearch FASEARCH_DB_USER=fasearch \
  FASEARCH_DB_PASSWORD=task-test-pw FASEARCH_OBJECT_ENDPOINT=http://127.0.0.1:$S3_PORT \
  FASEARCH_OBJECT_ACCESS_KEY=task-test-key FASEARCH_OBJECT_SECRET_KEY=task-test-secret \
  FASEARCH_AI_BASE_URL=http://127.0.0.1:$AI_PORT SERVER_PORT=$BOOT_PORT \
  FASEARCH_CATALOG_SNAPSHOT_ID=core-search-task-fixture-v1 \
  FASEARCH_MODEL_VERSION=fixture-v1+4eaad46f9361 FASEARCH_INDEX_VERSION=api-prototype-index-v1 \
  FASEARCH_CATALOG_FILE=/private/tmp/fasearch-ai-fixture/boot-catalog.jsonl \
  FASEARCH_BOOTSTRAP_ADMIN_USERNAME=task-admin FASEARCH_BOOTSTRAP_ADMIN_EMAIL=task-admin@example.test \
  FASEARCH_BOOTSTRAP_ADMIN_PASSWORD=Task-Admin-Test-Pass-123 FASEARCH_COOKIE_SECURE=false \
  nohup java -jar target/backend-0.0.1-SNAPSHOT.jar \
    > /private/tmp/fasearch-core-search-2h-boot.log 2>&1 &
  echo $! > $BOOT_PID_FILE

  cd "$ROOT/fe"
  FASEARCH_BACKEND_URL=http://127.0.0.1:$BOOT_PORT PORT=$FE_PORT \
  nohup npm run start -- --port $FE_PORT > /private/tmp/fasearch-core-search-2h-fe.log 2>&1 &
  echo $! > $FE_PID_FILE

  for i in $(seq 1 40); do do_health >/dev/null 2>&1 && break; sleep 3; done
  do_health
}

do_stop() {
  local pid
  # FE wrapper first (npm parent owns the next-server child).
  if [[ -f $FE_PID_FILE ]]; then
    pid=$(guard_pid "$FE_PID_FILE" "npm run start --port $FE_PORT") \
    && guard_listener "$(pgrep -P "$pid" | head -n 1)" "$FE_PORT" \
    && kill "$pid" && echo "stopped FE wrapper $pid" || return 1
  fi
  # Boot jar: verify executable name + task checkout jar path via cwd is not
  # visible in args; match the jar name and port through the log instead.
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
  start) do_start;; stop) do_stop;; health) do_health;; *)
    echo "usage: lifecycle.sh {start|stop|health}" >&2; exit 2;;
esac
