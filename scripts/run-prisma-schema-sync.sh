#!/bin/sh

set -e

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

MODE="${PRISMA_MIGRATION_MODE:-}"

if [ -z "$MODE" ]; then
  if [ "${NODE_ENV:-development}" = "production" ]; then
    MODE="migrate-deploy"
  else
    MODE="db-push"
  fi
fi

if [ "${NODE_ENV:-development}" = "production" ] && [ "$MODE" = "db-push" ]; then
  echo "[prisma-sync] ERROR: db-push está deshabilitado en producción."
  echo "[prisma-sync] Baselinea la base existente y usa PRISMA_MIGRATION_MODE=migrate-deploy."
  exit 1
fi

echo "[prisma-sync] Modo: $MODE"

case "$MODE" in
  migrate-deploy)
    echo "[prisma-sync] Ejecutando prisma migrate deploy..."
    pnpm exec prisma migrate deploy
    echo "[prisma-sync] Verificando guards SQL críticos..."
    node "$SCRIPT_DIR/ci/verify-accounting-sql-guards.mjs"
    ;;
  db-push)
    echo "[prisma-sync] Ejecutando prisma db push..."
    pnpm exec prisma db push --accept-data-loss
    ;;
  *)
    echo "[prisma-sync] ERROR: PRISMA_MIGRATION_MODE inválido: $MODE"
    echo "[prisma-sync] Valores permitidos: db-push | migrate-deploy"
    exit 1
    ;;
esac
