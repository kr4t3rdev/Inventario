#!/bin/sh
# Script de inicio del contenedor.
# Aplica migraciones versionadas antes de levantar el servidor en producción.
# En desarrollo, el modo db-push es el valor por defecto.

set -e

echo "[start] Sincronizando schema de Prisma con la base de datos..."
/app/scripts/run-prisma-schema-sync.sh

echo "[start] Schema sincronizado. Iniciando servidor Next.js..."
exec node server.js
