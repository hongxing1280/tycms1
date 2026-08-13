#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PUBLIC_WEB_URL="${PUBLIC_WEB_URL:-http://www.pubcms.com}"
ADMIN_WEB_URL="${ADMIN_WEB_URL:-http://admin.pubcms.com}"
API_URL="${API_URL:-http://api.pubcms.com}"
ADMIN_SAFE_ENTRY="${ADMIN_SAFE_ENTRY:-}"
ADMIN_TOTP_REQUIRED="${ADMIN_TOTP_REQUIRED:-}"
ADMIN_TOTP_SECRET="${ADMIN_TOTP_SECRET:-}"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found, installing pnpm"
  if command -v corepack >/dev/null 2>&1; then
    corepack enable
    corepack prepare pnpm@9.15.4 --activate
  else
    npm install -g pnpm@9.15.4
  fi
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 not found, installing pm2"
  npm install -g pm2
fi

echo "[1/5] install deps"
pnpm install --frozen-lockfile

echo "[2/5] build"
pnpm build

echo "[3/5] stop old pm2 apps if any"
pm2 delete sports-api >/dev/null 2>&1 || true
pm2 delete sports-web >/dev/null 2>&1 || true
pm2 delete sports-admin >/dev/null 2>&1 || true

echo "[4/5] start services"
API_PORT=4000 NODE_ENV=production PUBLIC_WEB_URL="$PUBLIC_WEB_URL" ADMIN_WEB_URL="$ADMIN_WEB_URL" API_URL="$API_URL" ADMIN_SAFE_ENTRY="$ADMIN_SAFE_ENTRY" ADMIN_TOTP_REQUIRED="$ADMIN_TOTP_REQUIRED" ADMIN_TOTP_SECRET="$ADMIN_TOTP_SECRET" pm2 start "pnpm --filter @sports/api start" --name sports-api
NODE_ENV=production PUBLIC_WEB_URL="$PUBLIC_WEB_URL" ADMIN_WEB_URL="$ADMIN_WEB_URL" API_URL="$API_URL" pm2 start "pnpm --filter @sports/web start" --name sports-web
NODE_ENV=production PUBLIC_WEB_URL="$PUBLIC_WEB_URL" ADMIN_WEB_URL="$ADMIN_WEB_URL" API_URL="$API_URL" ADMIN_SAFE_ENTRY="$ADMIN_SAFE_ENTRY" pm2 start "pnpm --filter @sports/admin start" --name sports-admin

echo "[5/5] save pm2 config"
pm2 save

echo "done"
