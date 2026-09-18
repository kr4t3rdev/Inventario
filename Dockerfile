# Builder
FROM node:22 AS builder
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
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

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

# Evitar que prisma.config.ts llegue al standalone; el runtime usa las variables de entorno.
RUN rm -f /app/prisma.config.ts

# Build con variables de entorno para estabilidad
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-http-header-size=80000 --dns-result-order=ipv4first"
RUN pnpm build

# Runtime
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production

# Instalar dependencias del sistema necesarias para Prisma y pnpm
RUN apt-get update && apt-get install -y \
    openssl \
    libssl-dev \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Habilitar pnpm via corepack (necesario para `prisma migrate deploy` en runtime)
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

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

# Instalar dependencias (incluye el CLI de Prisma y todas sus deps transitivas).
# Necesario para `prisma migrate deploy` en runtime.
# Usamos --ignore-scripts porque el postinstall "prisma generate" falla
# en runtime (no tenemos prisma.config.ts accesible). El cliente ya fue
# generado en el builder stage.
COPY package.json pnpm-lock.yaml ./
# Remover prisma.config.ts si existe para evitar que prisma generate falle
RUN rm -f /app/prisma.config.ts
RUN pnpm install --frozen-lockfile --prefer-offline --ignore-scripts || \
    (sleep 5 && pnpm install --frozen-lockfile --prefer-offline --ignore-scripts) || \
    (sleep 10 && pnpm install --frozen-lockfile --ignore-scripts)

# Copiar script de inicio (aplica migraciones antes de levantar el server)
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 8080
ENV HOSTNAME="0.0.0.0"
CMD ["/app/start.sh"]
