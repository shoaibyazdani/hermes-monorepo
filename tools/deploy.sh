#!/usr/bin/env bash
# tools/deploy.sh — build the Next.js app, restart it, reload nginx.
# Usage: ./tools/deploy.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)/apps/web"
LOG_DIR="/var/log/hermes-web"
PID_FILE="/var/run/hermes-web.pid"

mkdir -p "$LOG_DIR"

echo "[deploy] Building app..."
cd "$APP_DIR"
pnpm build 2>&1 | tail -5

echo "[deploy] Stopping previous instance (if any)..."
if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" || true
    sleep 2
  fi
  rm -f "$PID_FILE"
fi
# Belt + suspenders: kill any next-server still listening on 3000
pkill -f "next-server" 2>/dev/null || true
sleep 1

echo "[deploy] Starting next start..."
cd "$APP_DIR"
nohup pnpm start > "$LOG_DIR/app.log" 2>&1 &
PID=$!
echo "$PID" > "$PID_FILE"
sleep 3

echo "[deploy] Health check..."
HEALTH=$(curl -sL --max-time 5 -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000/api/health" || echo "000")
if [[ "$HEALTH" != "200" ]]; then
  echo "[deploy] FAIL — /api/health returned $HEALTH"
  echo "[deploy] Last 30 lines of app log:"
  tail -30 "$LOG_DIR/app.log"
  exit 1
fi

echo "[deploy] Reloading nginx..."
nginx -t 2>&1 | tail -2
nginx -s reload 2>&1 | tail -1

echo "[deploy] OK — running on PID $PID, health=$HEALTH"
