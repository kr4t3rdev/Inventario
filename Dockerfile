# Builder
FROM node:20 AS builder
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

# Declare DATABASE_URL so Railway injects it at build time (required by prisma.config.ts)
ARG DATABASE_URL

# Generar cliente Prisma
RUN pnpm prisma generate

# Build con variables de entorno para estabilidad
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-http-header-size=80000 --dns-result-order=ipv4first"
RUN pnpm build

# Runtime
FROM node:20
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

# Copiar Prisma
COPY --from=builder /app/prisma /app/prisma

# Copiar el cliente Prisma generado
RUN mkdir -p /app/node_modules/.prisma
COPY --from=builder /app/node_modules/.prisma/client /app/node_modules/.prisma/client
COPY --from=builder /app/node_modules/@prisma /app/node_modules/@prisma

# Crear script de inicio
RUN printf '#!/bin/sh\nset -e\necho "Iniciando aplicación..."\ncd /app\nexec node server.js\n' > /app/start.sh && chmod +x /app/start.sh

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["/app/start.sh"]
