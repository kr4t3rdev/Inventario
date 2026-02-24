#!/bin/bash

set -e

echo "========================================="
echo "  Deployment TCP - Todos los servicios"
echo "========================================="

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Cargar imágenes locales
echo -e "${YELLOW}[1/5] Cargando imágenes Docker...${NC}"

if [ -f "tcp-postgres.tar" ]; then
  docker load -i tcp-postgres.tar
  echo "  ✓ PostgreSQL cargado"
else
  echo "  ⚠ tcp-postgres.tar no encontrado"
fi

if [ -f "tcp-nginx.tar" ]; then
  docker load -i tcp-nginx.tar
  echo "  ✓ Nginx cargado"
else
  echo "  ⚠ tcp-nginx.tar no encontrado"
fi

# Etiquetar imágenes si es necesario
docker tag $(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E "^<none>" | head -1) tcp-postgres:latest 2>/dev/null || true
docker tag $(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E "^<none>" | head -1) tcp-nginx:latest 2>/dev/null || true

# 2. Construir imagen de la app
echo -e "${YELLOW}[2/5] Construyendo imagen de la app...${NC}"
docker build -t tcp-app:latest .
echo "  ✓ Imagen construida"

# 3. Iniciar servicios
echo -e "${YELLOW}[3/5] Iniciando servicios con Docker Compose...${NC}"
docker-compose down 2>/dev/null || true
docker-compose up -d --build

# 4. Esperar a PostgreSQL
echo -e "${YELLOW}[4/5] Esperando a PostgreSQL...${NC}"
for i in {1..30}; do
  if docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo "  ✓ PostgreSQL listo"
    break
  fi
  echo "  ⏳ Esperando... ($i/30)"
  sleep 2
done

# 5. Ejecutar Prisma
echo -e "${YELLOW}[5/5] Ejecutando Prisma migrations...${NC}"
sleep 5
docker-compose exec -T app pnpm prisma generate
docker-compose exec -T app pnpm prisma db push

echo -e "${GREEN}"
echo "========================================="
echo "  ✓ Deployment completado!"
echo "========================================="
echo ""
echo "  App:       http://localhost"
echo "  PostgreSQL: interno (no expuesto)"
echo ""
echo "  Comandos útiles:"
echo "    docker-compose logs -f app    # Ver logs"
echo "    docker-compose restart         # Reiniciar"
echo "    docker-compose down           # Detener"
echo -e "${NC}"
