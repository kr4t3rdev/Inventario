import type { Prisma } from '@/generated/prisma';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { ActionError } from '@/lib/server-actions';
import { requirePermission } from '@/lib/services/tenant-scope';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { saldoVivoCliente } from '@/features/crm/services/credito-calculo';

export type CreditoOverridePermission =
  | 'ventas.venta.credito-override'
  | 'ventas.servicios.credito-override'
  | 'financiero.prestamos-cash.credito-override'
  | 'financiero.cuentas-cobrar.credito-override';

export interface CreditoOverrideInput {
  tx: Prisma.TransactionClient;
  user: AuthenticatedUser;
  tenantId: string;
  clienteId: string;
  moneda: string;
  montoNuevo: number;
  permiso: CreditoOverridePermission;
  solicitarCreditoOverride?: boolean;
  motivoCreditoOverride?: string | null;
  clienteLockAdquirido?: boolean;
}

export interface CreditoOverrideDecision {
  exceeded: boolean;
  saldoAnterior: number;
  limiteCredito: number | null;
  exceso: number;
  motivo: string | null;
}

/** @description Valida el saldo de CxC del cliente dentro de la transacción de origen. */
export async function validarCreditoOrigen(
  input: CreditoOverrideInput,
): Promise<CreditoOverrideDecision> {
  if (!input.clienteLockAdquirido) {
    await bloquearClienteCredito(input.tx, input.tenantId, input.clienteId);
  }

  const cliente = await input.tx.cliente.findFirst({
    where: { clienteId: input.clienteId, tenantId: input.tenantId },
    select: { clienteId: true, limiteCredito: true },
  });
  if (!cliente) throw new ActionError('Cliente no encontrado o no pertenece al tenant', 'NOT_FOUND');

  const limiteCredito = cliente.limiteCredito == null ? null : Number(cliente.limiteCredito);
  // Sin tope configurado no hay exceso que validar: el cupo no impone decisión y la
  // homogeneidad de moneda de cuentas preexistentes no es exigible aún (fail-closed
  // sobre moneda aplica únicamente cuando debe compararse contra el límite).
  if (limiteCredito == null) {
    return { exceeded: false, saldoAnterior: 0, limiteCredito: null, exceso: 0, motivo: null };
  }

  const cuentas = await input.tx.cuentaPorCobrar.findMany({
    where: { tenantId: input.tenantId, clienteId: input.clienteId, estado: { not: 'ANULADA' } },
    select: { montoDeuda: true, montoPagado: true, monedaOriginal: true, estado: true },
  });
  const moneda = input.moneda.trim().toUpperCase();
  if (cuentas.some((cuenta) => !cuenta.monedaOriginal)) {
    throw new ActionError('No se puede validar el límite: una cuenta existente no tiene moneda verificable', 'FX_INSUFICIENTE');
  }
  const currencies = new Set(cuentas.map((cuenta) =>
    String(cuenta.monedaOriginal).trim().toUpperCase(),
  ));
  if ([...currencies].some((currency) => currency !== moneda)) {
    throw new ActionError('No se puede validar el límite con cuentas en monedas distintas', 'FX_INSUFICIENTE');
  }

  // Fórmula única compartida (2.6): saldoVivoCliente de credito-calculo.
  const saldoAnterior = saldoVivoCliente(
    cuentas.map((cuenta) => ({
      montoDeuda: Number(cuenta.montoDeuda),
      montoPagado: Number(cuenta.montoPagado),
      estado: cuenta.estado,
    })),
  );
  const exceso = Math.max(saldoAnterior + input.montoNuevo - limiteCredito, 0);
  if (exceso <= 0) {
    return { exceeded: false, saldoAnterior, limiteCredito, exceso: 0, motivo: null };
  }

  if (!input.solicitarCreditoOverride || !input.motivoCreditoOverride?.trim()) {
    throw new ActionError('La operación supera el límite de crédito y requiere autorización con motivo', 'CREDITO_EXCEDIDO');
  }
  requirePermission(input.user, input.permiso, 'autorizar una operación sobre el límite de crédito');
  return {
    exceeded: true,
    saldoAnterior,
    limiteCredito,
    exceso,
    motivo: input.motivoCreditoOverride.trim(),
  };
}

/**
 * @description Adquiere el lock tenant-scoped que serializa cualquier escritor del cupo.
 * @param {Prisma.TransactionClient} tx - Transacción propietaria del lock.
 * @param {string} tenantId - Tenant del cliente.
 * @param {string} clienteId - Cliente cuyo saldo se va a modificar.
 * @returns {Promise<void>} El lock se conserva hasta commit/rollback.
 */
export async function bloquearClienteCredito(
  tx: Prisma.TransactionClient,
  tenantId: string,
  clienteId: string,
): Promise<void> {
  if (typeof tx.$queryRaw !== 'function') {
    throw new ActionError(
      'No se pudo serializar la validación del límite de crédito',
      'CREDITO_LOCK_NO_DISPONIBLE',
    );
  }
  await tx.$queryRaw<Array<{ clienteId: string }>>`
    SELECT "clienteId"
    FROM "Cliente"
    WHERE "clienteId" = ${clienteId}
      AND "tenantId" = ${tenantId}
    FOR UPDATE
  `;
}

/** @description Persiste evidencia estricta del override junto a la obligación. */
export async function auditarCreditoOverride(params: {
  tx: Prisma.TransactionClient;
  user: AuthenticatedUser;
  decision: CreditoOverrideDecision;
  clienteId: string;
  tenantId: string;
  origen: string;
  origenId: string;
  montoNuevo: number;
}): Promise<void> {
  if (!params.decision.exceeded) return;
  await AuditLogService.logStrict({
    accion: 'EXECUTE',
    entidad: 'CUENTA_POR_COBRAR',
    entidadId: params.origenId,
    usuarioId: params.user.userId,
    detalles: {
      tipo: 'CREDITO_OVERRIDE',
      tenantId: params.tenantId,
      clienteId: params.clienteId,
      origen: params.origen,
      saldoAnterior: params.decision.saldoAnterior,
      limiteCredito: params.decision.limiteCredito,
      montoNuevo: params.montoNuevo,
      exceso: params.decision.exceso,
      motivo: params.decision.motivo,
    },
  }, params.tx);
}
