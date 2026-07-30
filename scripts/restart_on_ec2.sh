#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-student-management-system}"
APP_DIR="${APP_DIR:-/opt/student-management-system}"
APP_PORT="${APP_PORT:-3000}"

cd "$APP_DIR"

if command -v npm >/dev/null 2>&1; then
  npm ci --omit=dev
fi

mkdir -p "$APP_DIR/data"

if command -v sudo >/dev/null 2>&1; then
  sudo systemctl daemon-reload
  sudo nginx -t
  sudo systemctl reload nginx
  sudo systemctl restart "$APP_NAME"
  sudo systemctl status "$APP_NAME" --no-pager
else
  pkill -f "node $APP_DIR/index.js" || true
  PORT="$APP_PORT" DATA_DIR="$APP_DIR/data" nohup node "$APP_DIR/index.js" > "$APP_DIR/app.log" 2>&1 &
fi
