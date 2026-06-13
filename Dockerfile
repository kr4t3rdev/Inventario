# Builder
FROM node:20 AS builder
ARG DATABASE_URL
WORKDIR /app

# Instalar dependencias del sistema necesarias para Prisma y compilación
RUN apt-get update && apt-get install -y \
    openssl \
    libssl-dev \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Instalar PNPM primero
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar solo archivos de dependencias primero (mejor caching)
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Instalar dependencias
RUN pnpm install --frozen-lockfile --prefer-offline || \
    (sleep 5 && pnpm install --frozen-lockfile --prefer-offline) || \
    (sleep 10 && pnpm install --frozen-lockfile)

# Copiar código fuente
COPY . .

# Railway inyecta variables de servicio solo si se declaran con ARG en el Dockerfile
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

# Generar cliente Prisma (output: src/generated/prisma según schema)
RUN pnpm prisma generate

# Build con variables de entorno para estabilidad
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-http-header-size=80000 --dns-result-order=ipv4first"
RUN pnpm build

# Runtime
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production

# Instalar dependencias del sistema necesarias para Prisma
RUN apt-get update && apt-get install -y \
    openssl \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copiar standalone build como base
COPY --from=builder /app/.next/standalone /app

# Copiar archivos estáticos a la ubicación correcta dentro de standalone
COPY --from=builder /app/.next/static /app/.next/static

# Copiar archivos públicos
COPY --from=builder /app/public /app/public

# Copiar schema Prisma para usar en runtime
COPY --from=builder /app/prisma /app/prisma

# Copiar scripts de migración
COPY --from=builder /app/scripts /app/scripts

# Copiar el cliente Prisma generado (output en src/generated/prisma según schema)
COPY --from=builder /app/src/generated/prisma /app/src/generated/prisma

# Copiar runtime de @prisma (necesario para consultas)
COPY --from=builder /app/node_modules/@prisma /app/node_modules/@prisma

# El engine de Prisma ya está incluido en src/generated/prisma (Prisma 6 con prisma.config.ts)

# Crear script de inicio
RUN printf '#!/bin/sh\nset -e\necho "Iniciando aplicación..."\ncd /app\nexec node server.js\n' > /app/start.sh && chmod +x /app/start.sh

# Copiar prisma.config.ts para Prisma 6 runtime
COPY --from=builder /app/prisma.config.ts /app/prisma.config.ts

EXPOSE 8080
ENV HOSTNAME="0.0.0.0"
CMD ["/app/start.sh"]
