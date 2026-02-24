# Builder
FROM node:20-bookworm AS builder
WORKDIR /app

# Instalar PNPM primero
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar solo archivos de dependencias primero (mejor caching)
COPY package.json pnpm-lock.yaml ./

# Instalar dependencias con timeout extendido y retry
RUN pnpm install --frozen-lockfile --prefer-offline || \
    (sleep 5 && pnpm install --frozen-lockfile --prefer-offline) || \
    (sleep 10 && pnpm install --frozen-lockfile)

# Pre-descargar binarios de SWC para evitar timeouts durante build
RUN pnpm add @next/swc-linux-arm64-gnu --save-dev || true

# Copiar código fuente
COPY . .

# Build con variables de entorno para estabilidad
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-http-header-size=80000 --dns-result-order=ipv4first"
RUN pnpm build

# Runtime
FROM node:20-bookworm
WORKDIR /app
ENV NODE_ENV=production

# Instalar PNPM en runtime
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar archivos necesarios
COPY --from=builder /app/.next /app/.next
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm-lock.yaml /app/pnpm-lock.yaml

EXPOSE 3000
CMD ["pnpm", "start"]
