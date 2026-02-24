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

# Hacer push de Prisma para crear las tablas
echo "🔄 Aplicando migraciones de Prisma..."
npx prisma db push --accept-data-loss

# Generar cliente Prisma (por si acaso)
echo "🔄 Generando cliente Prisma..."
npx prisma generate

echo "✅ Configuración completada. Iniciando aplicación..."

# Iniciar la aplicación
exec node server.js
