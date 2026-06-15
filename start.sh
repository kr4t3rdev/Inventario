#!/bin/sh
# Script de inicio del contenedor.
# Sincroniza el schema de Prisma con la DB antes de levantar el servidor.
# Usa db push en vez de migrate deploy porque la DB existente no tiene
# el tracking de migraciones (_prisma_migrations).

set -e

echo "[start] Sincronizando schema de Prisma con la base de datos..."
pnpm exec prisma db push --accept-data-loss

echo "[start] Schema sincronizado. Iniciando servidor Next.js..."
exec node server.js
