#!/bin/sh

set -e

MODE="${PRISMA_MIGRATION_MODE:-db-push}"

echo "[prisma-sync] Modo: $MODE"

case "$MODE" in
  migrate-deploy)
    echo "[prisma-sync] Ejecutando prisma migrate deploy..."
    pnpm exec prisma migrate deploy
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
