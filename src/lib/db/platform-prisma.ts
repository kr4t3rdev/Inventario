/**
 * @description Cliente Prisma base SIN extensión de tenant (escape hatch auditado).
 * Usar SOLO desde la allowlist: autenticación, admin de plataforma, seeds,
 * scripts, afiliados/agentes comerciales y cron. Todo otro consumo debe usar
 * el cliente escopado de @/lib/prisma. El test de contrato impide imports
 * fuera de la allowlist.
 * @module src/lib/db/platform-prisma
 */
import type { PrismaClient } from '../../generated/prisma';
import { basePrisma } from './base-prisma';

/**
 * @description Evento estructurado emitido por cada operación del escape hatch.
 */
export interface PlatformPrismaAccess {
  model: string;
  operation: string;
}

type PlatformAccessReporter = (access: PlatformPrismaAccess) => void;

const defaultReporter: PlatformAccessReporter = (access) => {
  console.info('[prisma-platform]', JSON.stringify(access));
};

let reporter: PlatformAccessReporter = defaultReporter;

/**
 * @description Sustituye el reporter de acceso (tests) o restaura el default.
 * @param {PlatformAccessReporter | null} next - Reporter nuevo; null restaura el default.
 */
export function setPlatformAccessReporter(next: PlatformAccessReporter | null): void {
  reporter = next ?? defaultReporter;
}

/**
 * @description Construye la rama sin scope, pero con auditoría estructurada.
 * No inyecta ni modifica argumentos; solo registra modelo y operación.
 * @param {T} base - PrismaClient base compartido.
 * @returns {T} Rama platform auditada.
 */
export function buildPlatformClient<T extends PrismaClient>(base: T): T {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          try {
            reporter({ model, operation });
          } catch {
            // La telemetría nunca debe romper una operación de plataforma.
          }
          return query(args);
        },
      },
    },
  }) as unknown as T;
}

const prismaPlatform = buildPlatformClient(basePrisma);

export { prismaPlatform };
export default prismaPlatform;
