import { createHash } from 'node:crypto';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { requireFeature, requirePermission } from '@/lib/services/tenant-scope';
import { acquireAccountingTenantLock } from './accounting-tenant-lock-service';
import { initializationDraftContract } from './initialization-contract';

const requestSchema = z.object({
  tenantId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1).max(64),
  payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

type JsonObject = Record<string, Prisma.InputJsonValue | null>;

/** @description Valida evidencia JSON sin permitir valores que cambien al serializarse. */
function isJsonValue(value: unknown, visited = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || visited.has(value)) return false;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) return false;
  visited.add(value);
  const valid = Array.isArray(value)
    ? Array.from({ length: value.length }, (_, index) =>
      Object.hasOwn(value, index) && isJsonValue(value[index], visited)).every(Boolean)
    : Object.values(value).every((item) => isJsonValue(item, visited));
  visited.delete(value);
  return valid;
}

/** @description Serializa JSON con claves ordenadas para que el hash no dependa del orden de construcción. */
function stableStringify(value: unknown, seen = new Set<object>()): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new Error('El payload de inicialización contiene una referencia circular');
    seen.add(value);
    const out = '[' + value.map((item) => stableStringify(item, seen)).join(',') + ']';
    seen.delete(value);
    return out;
  }
  if (typeof value === 'object') {
    if (seen.has(value)) throw new Error('El payload de inicialización contiene una referencia circular');
    seen.add(value);
    const record = value as Record<string, unknown>;
    const out = '{' + Object.keys(record).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(record[key], seen)).join(',') + '}';
    seen.delete(value);
    return out;
  }
  throw new Error('El payload de inicialización contiene valores no serializables');
}

/**
 * @description Calcula el hash SHA-256 de una carga normalizada.
 * Dos cargas con el mismo contenido lógico producen el mismo hash aunque se
 * construyeran con distinto orden de claves; contenidos distintos, hash distinto.
 */
export function computeInitializationPayloadHash(payload: unknown): string {
  if (!isJsonValue(payload)) {
    throw new Error('El payload de inicialización contiene valores no serializables');
  }
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

/**
 * @description Gate de acceso a la inicialización contable: reutiliza el
 * permiso de aprobación de aperturas y la feature de contabilidad del plan.
 * El admin global pasa sin comprobar ninguno de los dos.
 */
export function assertInitializationAccess(user: AuthenticatedUser): void {
  requirePermission(user, 'financiero.apertura.aprobar', 'confirmar la inicialización contable');
  requireFeature(user, 'contabilidad', 'inicializar cuentas y saldos');
}

/**
 * @description Ejecuta una inicialización una sola vez bajo el bloqueo contable del tenant.
 * La frontera llamadora debe autenticar, autorizar y calcular el hash de la carga normalizada.
 * Abre una única transacción ReadCommitted: el lock debe preceder a la lectura del replay.
 * @param input - Tenant autorizado, clave de reintento y hash inmutable de la solicitud.
 * @param execute - Operación que usa exclusivamente la transacción recibida.
 * @returns Resultado persistido e indicador de repetición.
 */
export async function runIdempotentInitialization(
  input: z.input<typeof requestSchema>,
  execute: (tx: Prisma.TransactionClient, inicializacionId: string) => Promise<JsonObject>,
): Promise<{ replayed: boolean; resultado: JsonObject }> {
  const parsed = requestSchema.parse(input);
  return prisma.$transaction(async (tx) => {
  await acquireAccountingTenantLock(tx, parsed.tenantId);
  const previous = await tx.inicializacionContable.findFirst({
    where: { tenantId: parsed.tenantId },
  });
  let inicializacionId: string;
  if (previous) {
    if (previous.estado === 'BORRADOR') {
      if (previous.idempotencyKey !== parsed.idempotencyKey) {
        throw new ActionError('La inicialización ya tiene un borrador con otra clave de idempotencia', 'IDEMPOTENCY_CONFLICT');
      }
      const claimed = await tx.inicializacionContable.updateMany({
        where: { inicializacionId: previous.inicializacionId, tenantId: parsed.tenantId, estado: 'BORRADOR' },
        data: { estado: 'EN_PROGRESO', payloadHash: parsed.payloadHash },
      });
      if (claimed.count !== 1) {
        throw new ActionError('La inicialización anterior no tiene un resultado verificable', 'INITIALIZATION_INCOMPLETE');
      }
      inicializacionId = previous.inicializacionId;
    } else {
      if (previous.idempotencyKey !== parsed.idempotencyKey) {
        throw new ActionError('La empresa ya tiene una inicialización contable completada', 'INITIALIZATION_ALREADY_COMPLETED');
      }
      if (previous.payloadHash !== parsed.payloadHash) {
        throw new ActionError('La clave de idempotencia ya se usó con otra solicitud', 'IDEMPOTENCY_CONFLICT');
      }
      if (previous.estado !== 'COMPLETADA' || !previous.resultado ||
        Array.isArray(previous.resultado) || typeof previous.resultado !== 'object' ||
        !isJsonValue(previous.resultado)) {
        throw new ActionError('La inicialización anterior no tiene un resultado verificable', 'INITIALIZATION_INCOMPLETE');
      }
      return { replayed: true, resultado: previous.resultado as JsonObject };
    }
  } else {
    const created = await tx.inicializacionContable.create({ data: parsed });
    inicializacionId = created.inicializacionId;
  }
  const resultado = await execute(tx, inicializacionId);
  if (!resultado || Array.isArray(resultado) || typeof resultado !== 'object' || !isJsonValue(resultado)) {
    throw new ActionError('El resultado de la inicialización no es verificable', 'INITIALIZATION_INCOMPLETE');
  }
  const updated = await tx.inicializacionContable.updateMany({
    where: { inicializacionId, tenantId: parsed.tenantId, estado: 'EN_PROGRESO' },
    data: { estado: 'COMPLETADA', resultado: resultado as Prisma.InputJsonObject },
  });
  if (updated.count !== 1) {
    throw new ActionError('La evidencia de inicialización cambió durante la operación', 'INITIALIZATION_INCOMPLETE');
  }
  return { replayed: false, resultado };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}


const draftRequestSchema = z.object({
  tenantId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1).max(64),
  borrador: z.unknown(),
}).strict();

const draftLookupSchema = z.object({
  tenantId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1).max(64),
}).strict();

/**
 * @description Guarda o actualiza el borrador de inicialización de un tenant.
 * Solo se puede editar un borrador con su misma clave; una inicialización
 * completada o en curso no admite borrador. El borrador se valida con el
 * contrato parcial: la carga puede estar incompleta, pero lo que trae debe
 * tener forma válida.
 */
export async function guardarBorradorInicializacion(input: z.input<typeof draftRequestSchema>): Promise<{ idempotencyKey: string; payloadHash: string; estado: 'BORRADOR'; borrador: JsonObject }> {
  const parsed = draftRequestSchema.parse(input);
  if (parsed.borrador === null || typeof parsed.borrador !== 'object' || Array.isArray(parsed.borrador)) {
    throw new Error('El borrador de inicialización debe ser un objeto JSON');
  }
  const draft = initializationDraftContract.parse({ ...(parsed.borrador as Record<string, unknown>), idempotencyKey: parsed.idempotencyKey });
  const { idempotencyKey, ...payload } = draft;
  const payloadHash = computeInitializationPayloadHash(payload);
  return prisma.$transaction(async (tx) => {
    await acquireAccountingTenantLock(tx, parsed.tenantId);
    const previous = await tx.inicializacionContable.findFirst({ where: { tenantId: parsed.tenantId } });
    if (previous) {
      if (previous.estado === 'COMPLETADA') {
        throw new ActionError('La empresa ya tiene una inicialización contable completada', 'INITIALIZATION_ALREADY_COMPLETED');
      }
      if (previous.estado !== 'BORRADOR') {
        throw new ActionError('La inicialización anterior no tiene un resultado verificable', 'INITIALIZATION_INCOMPLETE');
      }
      if (previous.idempotencyKey !== parsed.idempotencyKey) {
        throw new ActionError('La clave de idempotencia ya se usó con otra solicitud', 'IDEMPOTENCY_CONFLICT');
      }
      const updated = await tx.inicializacionContable.updateMany({
        where: { inicializacionId: previous.inicializacionId, tenantId: parsed.tenantId, estado: 'BORRADOR' },
        data: { payloadHash, borrador: payload as Prisma.InputJsonObject },
      });
      if (updated.count !== 1) {
        throw new ActionError('La inicialización anterior no tiene un resultado verificable', 'INITIALIZATION_INCOMPLETE');
      }
    } else {
      await tx.inicializacionContable.create({
        data: { tenantId: parsed.tenantId, idempotencyKey: parsed.idempotencyKey, payloadHash, estado: 'BORRADOR', borrador: payload as Prisma.InputJsonObject },
      });
    }
    return { idempotencyKey: parsed.idempotencyKey, payloadHash, estado: 'BORRADOR' as const, borrador: payload as JsonObject };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

/**
 * @description Retoma el borrador de inicialización de un tenant por su clave.
 * Devuelve null si no hay nada que retomar.
 */
export async function obtenerBorradorInicializacion(input: z.input<typeof draftLookupSchema>): Promise<{ idempotencyKey: string; payloadHash: string; borrador: JsonObject } | null> {
  const parsed = draftLookupSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    await acquireAccountingTenantLock(tx, parsed.tenantId);
    const previous = await tx.inicializacionContable.findFirst({ where: { tenantId: parsed.tenantId } });
    if (!previous) return null;
    if (previous.estado === 'COMPLETADA') {
      throw new ActionError('La empresa ya tiene una inicialización contable completada', 'INITIALIZATION_ALREADY_COMPLETED');
    }
    if (previous.estado !== 'BORRADOR') {
      throw new ActionError('La inicialización anterior no tiene un resultado verificable', 'INITIALIZATION_INCOMPLETE');
    }
    if (previous.idempotencyKey !== parsed.idempotencyKey) {
      throw new ActionError('La clave de idempotencia ya se usó con otra solicitud', 'IDEMPOTENCY_CONFLICT');
    }
    if (!previous.borrador || Array.isArray(previous.borrador) || typeof previous.borrador !== 'object' || !isJsonValue(previous.borrador)) {
      throw new ActionError('La inicialización anterior no tiene un resultado verificable', 'INITIALIZATION_INCOMPLETE');
    }
    return { idempotencyKey: previous.idempotencyKey, payloadHash: previous.payloadHash, borrador: previous.borrador as JsonObject };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

const draftActualLookupSchema = z.object({
  tenantId: z.string().trim().min(1),
}).strict();

/**
 * @description Retoma el borrador actual de un tenant sin conocer su clave.
 * El tenant solo tiene una fila de inicialización, así que el borrador actual
 * es la fila en estado BORRADOR. Devuelve null si no hay nada que retomar.
 */
export async function obtenerBorradorActualInicializacion(input: z.input<typeof draftActualLookupSchema>): Promise<{ idempotencyKey: string; payloadHash: string; borrador: JsonObject } | null> {
  const parsed = draftActualLookupSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    await acquireAccountingTenantLock(tx, parsed.tenantId);
    const previous = await tx.inicializacionContable.findFirst({ where: { tenantId: parsed.tenantId } });
    if (!previous) return null;
    if (previous.estado === 'COMPLETADA') {
      throw new ActionError('La empresa ya tiene una inicialización contable completada', 'INITIALIZATION_ALREADY_COMPLETED');
    }
    if (previous.estado !== 'BORRADOR') {
      throw new ActionError('La inicialización anterior no tiene un resultado verificable', 'INITIALIZATION_INCOMPLETE');
    }
    if (!previous.borrador || Array.isArray(previous.borrador) || typeof previous.borrador !== 'object' || !isJsonValue(previous.borrador)) {
      throw new ActionError('La inicialización anterior no tiene un resultado verificable', 'INITIALIZATION_INCOMPLETE');
    }
    return { idempotencyKey: previous.idempotencyKey, payloadHash: previous.payloadHash, borrador: previous.borrador as JsonObject };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}
