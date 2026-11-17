import { z } from 'zod';
import { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';
import { acquireAccountingTenantLock } from './accounting-tenant-lock-service';

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
  execute: (tx: Prisma.TransactionClient) => Promise<JsonObject>,
): Promise<{ replayed: boolean; resultado: JsonObject }> {
  const parsed = requestSchema.parse(input);
  return prisma.$transaction(async (tx) => {
  await acquireAccountingTenantLock(tx, parsed.tenantId);
  const previous = await tx.inicializacionContable.findFirst({
    where: { tenantId: parsed.tenantId },
  });
  if (previous) {
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
  const created = await tx.inicializacionContable.create({ data: parsed });
  const resultado = await execute(tx);
  if (!resultado || Array.isArray(resultado) || typeof resultado !== 'object' || !isJsonValue(resultado)) {
    throw new ActionError('El resultado de la inicialización no es verificable', 'INITIALIZATION_INCOMPLETE');
  }
  const updated = await tx.inicializacionContable.updateMany({
    where: { inicializacionId: created.inicializacionId, tenantId: parsed.tenantId, estado: 'EN_PROGRESO' },
    data: { estado: 'COMPLETADA', resultado: resultado as Prisma.InputJsonObject },
  });
  if (updated.count !== 1) {
    throw new ActionError('La evidencia de inicialización cambió durante la operación', 'INITIALIZATION_INCOMPLETE');
  }
  return { replayed: false, resultado };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}
