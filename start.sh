#!/bin/sh
# Schema synchronization is opt-in so deploying the app does not mutate the database.
# Set PRISMA_SCHEMA_SYNC_ON_START=true and PRISMA_MIGRATION_MODE explicitly to enable it.

set -e

case "${PRISMA_SCHEMA_SYNC_ON_START:-false}" in
  false)
    echo "[start] Schema sync disabled; starting server without database schema changes."
    ;;
  true)
    if [ -z "${PRISMA_MIGRATION_MODE:-}" ]; then
      echo "[start] ERROR: PRISMA_MIGRATION_MODE must be explicitly set when schema sync is enabled."
      exit 1
    fi
    echo "[start] Running explicitly configured Prisma schema sync..."
    /app/scripts/run-prisma-schema-sync.sh
    ;;
  *)
    echo "[start] ERROR: PRISMA_SCHEMA_SYNC_ON_START must be 'true' or 'false'."
    exit 1
    ;;
esac

case "${PRISMA_MIGRATION_GUARD_ON_START:-true}" in
  true)
    echo "[start] Checking Prisma migration status..."
    if ! node /app/scripts/check-prisma-migration-status.cjs; then
      echo "[start] ERROR: database migrations are not up to date; refusing to start." >&2
      exit 1
    fi
    ;;
  false)
    echo "[start] WARNING: Prisma migration guard disabled by configuration." >&2
    ;;
  *)
    echo "[start] ERROR: PRISMA_MIGRATION_GUARD_ON_START must be 'true' or 'false'." >&2
    exit 1
    ;;
esac

exec node server.js
