/**
 * @description Singleton del PrismaClient base compartido por las dos ramas:
 * scoped (negocio) y platform (escape hatch auditado). No importar fuera de
 * src/lib/db ni src/lib/prisma.ts.
 * @module src/lib/db/base-prisma
 */
import { PrismaClient } from '../../generated/prisma';

declare global {
  var __basePrisma: PrismaClient | undefined;
}

const basePrisma = globalThis.__basePrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__basePrisma = basePrisma;
}

export { basePrisma };
