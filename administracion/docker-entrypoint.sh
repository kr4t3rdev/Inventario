#!/bin/sh
set -e

echo "🏗️  Iniciando configuración de la aplicación..."

# Esperar a que la base de datos esté disponible
echo "⏳ Esperando conexión a la base de datos..."
until nc -z db 5432; do
  echo "🔄 Esperando PostgreSQL..."
  sleep 2
done
echo "✅ Base de datos conectada"

# Aplicar migraciones versionadas. Si falla, el contenedor no inicia.
echo "🔄 Aplicando migraciones versionadas de Prisma..."
npx prisma migrate deploy
node /app/scripts/ci/verify-accounting-sql-guards.mjs

# Generar cliente Prisma (por si acaso)
echo "🔄 Generando cliente Prisma..."
npx prisma generate

echo "✅ Configuración completada. Iniciando aplicación..."

# Iniciar la aplicación
exec node server.js
