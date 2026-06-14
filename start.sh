#!/bin/sh
# Script de inicio del contenedor.
# Aplica migraciones pendientes de Prisma antes de levantar el servidor.
# Esto evita que el schema de la DB quede desincronizado del schema.prisma
# (causa raíz de errores PrismaClientValidationError en producción).

set -e

echo "[start] Verificando migraciones de Prisma..."
pnpm exec prisma migrate deploy

echo "[start] Migraciones aplicadas. Iniciando servidor Next.js..."
exec node server.js
