#!/usr/bin/env bash
# TrustChain — start backend + web (local dev)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

BACKEND_PORT="${BACKEND_PORT:-3001}"
WEB_PORT="${WEB_PORT:-5173}"
export NOTIFICATION_WORKER_ENABLED="${NOTIFICATION_WORKER_ENABLED:-false}"
export PUBLIC_APP_URL="${PUBLIC_APP_URL:-http://localhost:${WEB_PORT}}"
LOG_DIR="$ROOT/.logs"
BACKEND_PID=""
WEB_PID=""

log() { printf '\033[1;36m[trustchain]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[trustchain]\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31m[trustchain]\033[0m %s\n' "$*" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

free_port() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    warn "Port $port in use — stopping PID(s): $pids"
    kill $pids 2>/dev/null || true
    sleep 1
  fi
}

cleanup() {
  log "Shutting down…"
  [[ -n "$WEB_PID" ]] && kill "$WEB_PID" 2>/dev/null || true
  [[ -n "$BACKEND_PID" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

need_cmd node
need_cmd npm
need_cmd lsof

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
[[ "$NODE_MAJOR" -ge 20 ]] || die "Node.js 20+ required (found $(node -v))"

[[ -f "$ROOT/apps/backend/.env" ]] || warn "apps/backend/.env missing — copy from apps/backend/.env.example"
[[ -f "$ROOT/apps/web/.env" ]] || warn "apps/web/.env missing — set VITE_API_URL=http://localhost:$BACKEND_PORT"

if [[ ! -d "$ROOT/node_modules" ]]; then
  log "Installing dependencies…"
  npm install
fi

mkdir -p "$LOG_DIR"
free_port "$BACKEND_PORT"
free_port "$WEB_PORT"

needs_backend_build=0
if [[ ! -f "$ROOT/apps/backend/dist/index.js" ]]; then
  needs_backend_build=1
elif find "$ROOT/apps/backend/src" -type f -newer "$ROOT/apps/backend/dist/index.js" -print -quit | grep -q .; then
  needs_backend_build=1
fi

if [[ "$needs_backend_build" -eq 1 ]]; then
  log "Building backend…"
  npm run build -w @trustchain/config
  npm run db:generate
  npm run build -w @trustchain/database
  npm run build -w @trustchain/backend
fi

log "Starting backend on http://localhost:$BACKEND_PORT"
npm run start -w @trustchain/backend >>"$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

log "Starting web on http://localhost:$WEB_PORT"
npm run dev -w @trustchain/web >>"$LOG_DIR/web.log" 2>&1 &
WEB_PID=$!

# Wait for health
for _ in $(seq 1 60); do
  if curl -sf "http://localhost:$BACKEND_PORT/api/v1/health" >/dev/null 2>&1 \
    && curl -sf "http://localhost:$WEB_PORT/" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if curl -sf "http://localhost:$BACKEND_PORT/api/v1/health" >/dev/null 2>&1; then
  log "Backend ready  → http://localhost:$BACKEND_PORT/api/v1/health"
else
  warn "Backend not responding yet — see $LOG_DIR/backend.log"
fi

if curl -sf "http://localhost:$WEB_PORT/" >/dev/null 2>&1; then
  log "Frontend ready → http://localhost:$WEB_PORT"
else
  warn "Frontend not responding yet — see $LOG_DIR/web.log"
fi

log "Logs: $LOG_DIR/backend.log | $LOG_DIR/web.log"
log "Press Ctrl+C to stop both servers."

wait
