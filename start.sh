#!/bin/sh
# Script de inicio del contenedor.
# Sincroniza el schema de Prisma con la DB antes de levantar el servidor.
# Por compatibilidad, el modo por defecto sigue siendo `db-push`.
# Una vez baselineada la DB de producción, configurar:
#   PRISMA_MIGRATION_MODE=migrate-deploy

set -e

echo "[start] Sincronizando schema de Prisma con la base de datos..."
/app/scripts/run-prisma-schema-sync.sh

echo "[start] Schema sincronizado. Iniciando servidor Next.js..."
exec node server.js
