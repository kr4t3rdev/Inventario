/**
 * @description Lista cerrada de consumidores autorizados del cliente Prisma
 * sin enforcement tenant. Las reglas terminadas en /** son prefijos; el resto
 * son archivos exactos. Todo cambio pasa por el contrato estático AS-03.
 * @module src/lib/db/platform-prisma-allowlist
 */
export const PLATFORM_PRISMA_ALLOWLIST = [
  'src/lib/prisma.ts',
  'src/lib/db/**',
  'src/lib/auth-middleware.ts',
  'src/lib/services/tenant-factory.ts',
  'src/lib/services/demo-tenant-factory.ts',
  'src/features/auth/api/handlers.ts',
  'src/features/admin/**',
  'src/features/affiliate/**',
  'src/features/backups/**',
  'src/features/sales-agent/**',
  'src/app/api/auth/**',
  'src/app/api/mobile/v1/auth/**',
  'src/app/api/cron/backups/**',
  'src/app/api/cron/demos/**',
  'prisma/seed/**',
  'scripts/**',
] as const;
