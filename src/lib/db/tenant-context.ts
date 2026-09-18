/**
 * @description Contexto de tenant por request vía AsyncLocalStorage (AS-02).
 * Los dos únicos puntos de poblado son authenticateUser (API routes) y
 * withAction (server actions); ambos ya resuelven la membresía hoy. El
 * contexto es inmutable dentro del request y nunca se propaga entre requests.
 * @module src/lib/db/tenant-context
 */
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * @description Valor del contexto de tenant del request en curso.
 * @param tenantId - ID del tenant al que queda escopado el request.
 */
export interface TenantContextValue {
  tenantId: string;
}

const storage = new AsyncLocalStorage<TenantContextValue>();

/**
 * @description Lee el contexto de tenant del request en curso.
 * @returns {TenantContextValue | undefined} Contexto o undefined fuera de request.
 */
export function getTenantContext(): TenantContextValue | undefined {
  return storage.getStore();
}

/**
 * @description Ejecuta una función con el tenant fijado (vía recomendada).
 * IMPORTANTE: los queries Prisma son lazy (se ejecutan al primer await/then),
 * por lo que el callback debe hacer await DENTRO:
 *   await runWithTenantContext(id, async () => await prisma.x.findMany())
 * Retornar el PrismaPromise sin await lo ejecuta fuera del contexto.
 * @param {string} tenantId - Tenant al que escopar la ejecución.
 * @param {() => T} fn - Función a ejecutar dentro del contexto.
 * @returns {T} Resultado de la función.
 */
export function runWithTenantContext<T>(tenantId: string, fn: () => T): T {
  return storage.run({ tenantId }, fn);
}

/**
 * @description Fija el tenant en la cadena async actual (para authenticateUser,
 * cuyos llamantes directos continúan en la misma cadena). Preferir
 * runWithTenantContext siempre que se pueda envolver el handler.
 * @param {string} tenantId - Tenant al que escopar la cadena actual.
 */
export function enterTenantContext(tenantId: string): void {
  storage.enterWith({ tenantId });
}

/**
 * @description Alias de runWithTenantContext para tests e integración.
 * @param {string} tenantId - Tenant al que escopar la ejecución.
 * @param {() => T} fn - Función a ejecutar dentro del contexto.
 * @returns {T} Resultado de la función.
 */
export function withTestTenant<T>(tenantId: string, fn: () => T): T {
  return runWithTenantContext(tenantId, fn);
}
