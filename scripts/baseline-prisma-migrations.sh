#!/bin/sh

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL no está definido"
  exit 1
fi

echo "[baseline] Verificando migraciones locales..."

for migration_dir in prisma/migrations/*; do
  if [ ! -d "$migration_dir" ]; then
    continue
  fi

  migration_name=$(basename "$migration_dir")
  echo "[baseline] Marcando como aplicada: $migration_name"
  pnpm exec prisma migrate resolve --applied "$migration_name"
done

echo "[baseline] Estado final:"
pnpm exec prisma migrate status
