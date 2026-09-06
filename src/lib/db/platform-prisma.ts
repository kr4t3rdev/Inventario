/**
 * @description Cliente Prisma base SIN extensión de tenant (escape hatch auditado).
 * Usar SOLO desde la allowlist: autenticación, admin de plataforma, seeds,
 * scripts, afiliados/agentes comerciales y cron. Todo otro consumo debe usar
 * el cliente escopado de @/lib/prisma. El test de contrato impide imports
 * fuera de la allowlist.
 * @module src/lib/db/platform-prisma
 */
import { PrismaClient } from '../../generated/prisma';

declare global {
  var __platformPrisma: PrismaClient | undefined;
}

const prismaPlatform = globalThis.__platformPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__platformPrisma = prismaPlatform;
}

export { prismaPlatform };
export default prismaPlatform;
