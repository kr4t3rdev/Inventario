/**
 * @description Cliente Prisma con enforcement sistémico del aislamiento tenant (AS-02).
 * Inyecta y valida tenantId en toda operación sobre modelos scoped según el
 * modo TENANT_ISOLATION_MODE: off (passthrough), shadow (registra violaciones
 * sin romper) o enforce (inyecta y rechaza). La lógica pura
 * (applyTenantScope/interceptOperation) se prueba sin base de datos; el
 * cableado $extends se verifica en __integration__.
 * @module src/lib/db/scoped-prisma
 */
import type { PrismaClient } from '@/generated/prisma';
import { recordShadowViolation } from './shadow-violation-store';
import { getModelScope } from './model-classification';
import { getTenantContext } from './tenant-context';

/**
 * @description Modos operativos del enforcement.
 */
export type TenantIsolationMode = 'off' | 'shadow' | 'enforce';

/**
 * @description Kinds de violación reportada en modo shadow.
 */
export type ViolationKind = 'missing-context' | 'missing-scope' | 'tenant-mismatch' | 'unclassified-model';

/**
 * @description Reporte estructurado de violación (telemetría del modo shadow).
 */
export interface ViolationReport {
  kind: ViolationKind;
  model: string;
  operation?: string;
  mode: TenantIsolationMode;
}

type ViolationReporter = (report: ViolationReport) => void;

const defaultReporter: ViolationReporter = (report) => {
  recordShadowViolation(report);
  console.warn('[tenant-isolation]', JSON.stringify(report));
};

let reporter: ViolationReporter = defaultReporter;

/**
 * @description Sustituye el reportero de violaciones (tests) o lo restaura.
 * @param {ViolationReporter | null} next - Nuevo reportero; null restaura el default.
 */
export function setViolationReporter(next: ViolationReporter | null): void {
  reporter = next ?? defaultReporter;
}

/**
 * @description Colector en proceso de violaciones (modo shadow). Acumula
 * reportes para exportarlos como reporte consolidado (AS-04 T1) sin depender
 * de logging. No es thread-safe ni pensado para producción de alto volumen;
 * el volumen del proyecto lo hace suficiente.
 */
export interface ViolationCollector {
  /** @description Violaciones acumuladas hasta el momento. */
  reports: ViolationReport[];
  /** @description Instala el collector como reportero y lo limpia. */
  install: () => void;
  /** @description Devuelve las violaciones y resetea el buffer. */
  flush: () => ViolationReport[];
}

/**
 * @description Crea un collector de violaciones y lo activa como reportero.
 * @returns {ViolationCollector} Collector listo para flush.
 */
export function createViolationCollector(): ViolationCollector {
  const reports: ViolationReport[] = [];
  const collector: ViolationCollector = {
    reports,
    install() {
      setViolationReporter((report) => {
        reports.push(report);
      });
    },
    flush() {
      const snapshot = reports.slice();
      reports.length = 0;
      return snapshot;
    },
  };
  collector.install();
  return collector;
}

/**
 * @description Emite un reporte de violación al reportero activo.
 * @param {ViolationReport} report - Reporte a emitir.
 */
function reportViolation(report: ViolationReport): void {
  try {
    reporter(report);
  } catch {
    // El reporte nunca debe romper el flujo de negocio.
  }
}

/**
 * @description Lee el modo operativo desde el entorno (default off hasta el gate).
 * @returns {TenantIsolationMode} Modo vigente.
 */
export function getIsolationMode(): TenantIsolationMode {
  const raw = process.env.TENANT_ISOLATION_MODE;
  if (raw === 'shadow' || raw === 'enforce') return raw;
  return 'off';
}

/**
 * @description Error fail-closed: operación sobre modelo scoped sin contexto tenant.
 */
export class TenantContextRequiredError extends Error {
  code = 'TENANT_CONTEXT_REQUIRED';
  /**
   * @description Crea el error de contexto faltante.
   * @param {string} model - Modelo accedido sin contexto.
   * @param {string} operation - Operación intentada.
   */
  constructor(model: string, operation: string) {
    super(`Operación ${operation} sobre ${model} requiere contexto de tenant`);
    this.name = 'TenantContextRequiredError';
  }
}

/**
 * @description Error fail-closed: payload con tenant distinto al del contexto.
 */
export class TenantMismatchError extends Error {
  code = 'TENANT_MISMATCH';
  /**
   * @description Crea el error de tenant distinto.
   * @param {string} model - Modelo de la escritura.
   * @param {string} operation - Operación intentada.
   * @param {string} expected - Tenant del contexto.
   * @param {string} received - Tenant del payload.
   */
  constructor(model: string, operation: string, expected: string, received: string) {
    super(`Escritura ${operation} sobre ${model} con tenant ${received} fuera del contexto ${expected}`);
    this.name = 'TenantMismatchError';
  }
}

/** @description Operaciones de lectura/agregación con where componible por AND. */
const READ_MANY_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

/** @description Operaciones sobre where único (extendedWhereUnique, solo lectura/borrado). */
const UNIQUE_OPS = new Set(['findUnique', 'findUniqueOrThrow', 'delete']);

/** @description Escrituras masivas con where componible por AND. */
const MANY_WRITE_OPS = new Set(['updateMany', 'updateManyAndReturn', 'deleteMany']);

/**
 * @description Indica si un valor es un objeto plano (argumento Prisma).
 * @param {unknown} value - Valor a inspeccionar.
 * @returns {boolean} true si es objeto plano.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * @description Inyecta tenantId en un where con AND (sin mutar el original).
 * @param {unknown} where - Where original (puede ser undefined).
 * @param {string} tenantId - Tenant del contexto.
 * @returns {unknown} Where con el filtro tenant aplicado.
 */
function injectWhereTenant(where: unknown, tenantId: string): unknown {
  if (where === undefined || where === null) return { tenantId };
  return { AND: [where, { tenantId }] };
}

/**
 * @description Extiende un where único con tenantId (sin mutar el original).
 * @param {unknown} where - Where único original.
 * @param {string} tenantId - Tenant del contexto.
 * @returns {unknown} Where único extendido.
 */
function extendUniqueWhere(where: unknown, tenantId: string): unknown {
  if (!isRecord(where)) return { tenantId };
  return { ...where, tenantId };
}

/**
 * @description Rechaza payloads (incluidos anidados) con tenant distinto.
 * @param {unknown} value - Data a inspeccionar recursivamente.
 * @param {string} model - Modelo de la operación (para el error).
 * @param {string} operation - Operación en curso (para el error).
 * @param {string} tenantId - Tenant del contexto.
 */
function assertNoNestedMismatch(
  value: unknown,
  model: string,
  operation: string,
  tenantId: string,
): void {
  if (Array.isArray(value)) {
    for (const item of value) assertNoNestedMismatch(item, model, operation, tenantId);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'tenantId') {
      if (typeof entry === 'string' && entry !== tenantId) {
        throw new TenantMismatchError(model, operation, tenantId, entry);
      }
      continue;
    }
    assertNoNestedMismatch(entry, model, operation, tenantId);
  }
}

/**
 * @description Aplica la regla create a una fila: inyecta o valida tenantId.
 * @param {unknown} row - Fila de data (objeto).
 * @param {string} model - Modelo de la operación.
 * @param {string} operation - Operación en curso.
 * @param {string} tenantId - Tenant del contexto.
 * @returns {unknown} Fila con tenantId garantizado.
 */
function scopeCreateRow(
  row: unknown,
  model: string,
  operation: string,
  tenantId: string,
): unknown {
  if (!isRecord(row)) return row;
  if (typeof row.tenantId === 'string' && row.tenantId !== tenantId) {
    throw new TenantMismatchError(model, operation, tenantId, row.tenantId);
  }
  assertNoNestedMismatch(row, model, operation, tenantId);
  if (row.tenantId === undefined) return { ...row, tenantId };
  return row;
}

/**
 * @description Transforma los args de una operación sobre modelo scoped
 * (semántica enforce). Función pura: no muta la entrada.
 * @param {string} model - Modelo Prisma.
 * @param {string} operation - Operación Prisma.
 * @param {TArgs} args - Argumentos originales.
 * @param {string} tenantId - Tenant del contexto.
 * @returns {TArgs} Argumentos con el scope aplicado.
 */
export function applyTenantScope<TArgs>(
  model: string,
  operation: string,
  args: TArgs,
  tenantId: string,
): TArgs {
  const scope = getModelScope(model);
  if (scope !== 'scoped') return args;
  if (!isRecord(args)) return args;

  if (READ_MANY_OPS.has(operation) || MANY_WRITE_OPS.has(operation)) {
    return { ...args, where: injectWhereTenant(args.where, tenantId) };
  }
  if (UNIQUE_OPS.has(operation)) {
    return { ...args, where: extendUniqueWhere(args.where, tenantId) };
  }
  if (operation === 'create' || operation === 'createMany' || operation === 'createManyAndReturn') {
    const data = args.data;
    const scoped = Array.isArray(data)
      ? data.map((row) => scopeCreateRow(row, model, operation, tenantId))
      : scopeCreateRow(data, model, operation, tenantId);
    return { ...args, data: scoped };
  }
  if (operation === 'upsert') {
    const create = args.create;
    if (isRecord(create) || Array.isArray(create)) {
      const scoped = Array.isArray(create)
        ? create.map((row) => scopeCreateRow(row, model, operation, tenantId))
        : scopeCreateRow(create, model, operation, tenantId);
      const update = args.update;
      if (isRecord(update)) assertNoNestedMismatch(update, model, operation, tenantId);
      return { ...args, where: extendUniqueWhere(args.where, tenantId), create: scoped };
    }
    return { ...args, where: extendUniqueWhere(args.where, tenantId) };
  }
  if (operation === 'update' || operation === 'updateMany' || operation === 'updateManyAndReturn') {
    const data = args.data;
    if (isRecord(data) || Array.isArray(data)) {
      assertNoNestedMismatch(data, model, operation, tenantId);
    }
    if (operation === 'update') {
      return { ...args, where: extendUniqueWhere(args.where, tenantId) };
    }
    return { ...args, where: injectWhereTenant(args.where, tenantId) };
  }
  return args;
}

/**
 * @description Detecta si una data menciona un tenant distinto al del contexto.
 * @param {unknown} data - Data a inspeccionar.
 * @param {string} tenantId - Tenant del contexto.
 * @returns {boolean} true si hay tenant ajeno.
 */
function dataMentionsForeignTenant(data: unknown, tenantId: string): boolean {
  if (Array.isArray(data)) return data.some((row) => dataMentionsForeignTenant(row, tenantId));
  if (!isRecord(data)) return false;
  return Object.entries(data).some(([key, entry]) => {
    if (key === 'tenantId') return typeof entry === 'string' && entry !== tenantId;
    return dataMentionsForeignTenant(entry, tenantId);
  });
}

/**
 * @description Determina si la operación violaría el scope en modo shadow.
 * Con contexto presente, el enforce SIEMPRE inyecta tenantId en scoped, por
 * lo que una query que omite el filtro no es una violación: es la ruta normal.
 * Las únicas violaciones reales en shadow son las escrituras con tenantId
 * ajeno (enforce las rechazaría con TenantMismatchError).
 * @param {string} operation - Operación Prisma.
 * @param {unknown} args - Argumentos originales.
 * @param {string} tenantId - Tenant del contexto.
 * @returns {ViolationKind | null} Kind de violación o null si está escopada.
 */
function detectShadowViolation(
  operation: string,
  args: unknown,
  tenantId: string,
): ViolationKind | null {
  if (!isRecord(args)) return null;
  if (operation === 'create' || operation === 'createMany' || operation === 'createManyAndReturn') {
    return dataMentionsForeignTenant(args.data, tenantId) ? 'tenant-mismatch' : null;
  }
  if (operation === 'upsert') {
    if (dataMentionsForeignTenant(args.create, tenantId)) return 'tenant-mismatch';
    return null;
  }
  if (operation === 'update' || operation === 'updateMany' || operation === 'updateManyAndReturn') {
    return dataMentionsForeignTenant(args.data, tenantId) ? 'tenant-mismatch' : null;
  }
  return null;
}

/**
 * @description Orquesta modo + contexto + transformación para una operación.
 * Capa pura (sin queries): devuelve los args a ejecutar o lanza en enforce.
 * @param {string} model - Modelo Prisma.
 * @param {string} operation - Operación Prisma.
 * @param {TArgs} args - Argumentos originales.
 * @returns {TArgs} Argumentos a pasar al query real.
 */
export function interceptOperation<TArgs>(model: string, operation: string, args: TArgs): TArgs {
  const mode = getIsolationMode();
  if (mode === 'off') return args;

  let scope: string;
  try {
    scope = getModelScope(model);
  } catch {
    reportViolation({ kind: 'unclassified-model', model, operation, mode });
    return args;
  }
  if (scope !== 'scoped') return args;

  const ctx = getTenantContext();
  if (!ctx) {
    if (mode === 'shadow') {
      reportViolation({ kind: 'missing-context', model, operation, mode });
      return args;
    }
    throw new TenantContextRequiredError(model, operation);
  }

  if (mode === 'shadow') {
    const violation = detectShadowViolation(operation, args, ctx.tenantId);
    if (violation && violation !== 'unclassified-model') {
      reportViolation({ kind: violation, model, operation, mode });
    }
    return args;
  }

  return applyTenantScope(model, operation, args, ctx.tenantId);
}

/**
 * @description Construye el cliente escopado sobre un PrismaClient base.
 * La extensión solo intercepta argumentos (no añade métodos), por lo que el
 * tipo expuesto sigue siendo PrismaClient y los 437 call sites no cambian.
 * @param {T} base - Cliente base sin extensión (normalmente prismaPlatform).
 * @returns {T} Cliente con enforcement de tenant.
 */
export function buildScopedClient<T extends PrismaClient>(base: T): T {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          return query(interceptOperation(model, operation, args));
        },
      },
    },
  }) as unknown as T;
}
