#!/usr/bin/env bash
# Khởi động FE candidate của task fork-reliability-batch trên cổng 3108, trỏ cả hai
# adapter về BE cô lập 18096. Không chạm runtime cũ (3107/18095).
#
# Dùng: scripts/run-fe-3108.sh [workdir]   (mặc định: worktree integration)
# Yêu cầu: cây đã commit sạch + .next đã build từ đúng cây đó.
set -euo pipefail

WORKDIR="${1:-/home/dolakhoa/projects/fasearch-migration/worktrees/reliability-integration/fe}"
BE_URL="${BE_URL:-http://127.0.0.1:18096}"
PORT="${PORT:-3108}"
LOG="${LOG:-/tmp/fe3108-reliability.log}"

if [ ! -f "$WORKDIR/.next/BUILD_ID" ]; then
  echo "Chưa có build tại $WORKDIR/.next — chạy 'npx next build' trong $WORKDIR trước." >&2
  exit 1
fi
BUILD_ID="$(cat "$WORKDIR/.next/BUILD_ID")"

if ss -tlnp 2>/dev/null | grep -q ":${PORT} "; then
  echo "Cổng ${PORT} đang bị chiếm — dừng." >&2
  exit 1
fi

cd "$WORKDIR"
FASEARCH_BACKEND_URL="$BE_URL" \
FASEARCH_WAREHOUSE_URL="$BE_URL" \
  setsid nohup npx next start -p "$PORT" > "$LOG" 2>&1 < /dev/null &
disown

for _ in $(seq 1 40); do
  sleep 1
  if curl -s -o /dev/null --max-time 5 "http://127.0.0.1:${PORT}/"; then
    PID="$(ss -tlnp 2>/dev/null | grep ":${PORT} " | grep -oP 'pid=\K[0-9]+' | head -1)"
    echo "FE3108 sẵn sàng: build ${BUILD_ID} pid ${PID} -> ${BE_URL} (log ${LOG})"
    exit 0
  fi
done

echo "Không phản hồi trên cổng ${PORT}; xem ${LOG}" >&2
exit 1
