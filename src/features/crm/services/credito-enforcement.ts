/**
 * @description Enforcement compartido del tope de crédito del cliente (C-2).
 * Reutiliza las reglas puras de `credito-calculo` y el permiso
 * `ventas.venta.credito-override`. No audita: el caller registra el override
 * con `AuditLogService.logStrict` dentro de su propia transacción.
 */
import { ActionError } from '@/lib/server-actions';
import { hasPermission } from '@/lib/services/tenant-scope';
import { saldoVivoCliente, superaLimiteCredito } from '@/features/crm/services/credito-calculo';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import type { Prisma } from '@/generated/prisma';

export const PERMISO_CREDITO_OVERRIDE = 'ventas.venta.credito-override';

/** Cliente Prisma (raíz o transaccional) necesario para evaluar el tope. */
export type ClientCredito = Pick<Prisma.TransactionClient, 'cliente' | 'cuentaPorCobrar'>;

export interface ExigirLimiteCreditoParams {
  /** Cliente Prisma raíz o transacción del caller (la evaluación corre dentro de su flujo). */
  client: ClientCredito;
  tenantId: string;
  clienteId: string;
  /** Nuevo crédito solicitado (venta completa, remanente tras anticipos, o el monto nuevo de la cuenta excluida). */
  montoRequerido: number;
  user: AuthenticatedUser;
  /** CxC propia del caller (update): sale del saldo vivo y su deuda es reemplazada por montoRequerido. */
  cuentaExcluidaId?: string;
}

export interface ResultadoLimiteCredito {
  overrideUsado: boolean;
  saldoVivo: number;
  limiteCredito: number | null;
  /** Monto efectivamente evaluado contra el tope (requerido tal cual salvo fast-path). */
  montoEvaluado: number;
}

/**
 * @description Valida que un nuevo crédito no supere el tope del cliente.
 * Fast-paths sin consulta: montoRequerido <= 0 (no crea crédito nuevo) y
 * límite null (sin tope). Si se supera el tope sin el permiso de override
 * lanza CREDITO_EXCEDIDO con el mensaje estándar del sistema.
 * @param {ExigirLimiteCreditoParams} params - Contexto de la evaluación.
 * @returns {Promise<ResultadoLimiteCredito>} Override usado, saldo vivo, límite y monto evaluado.
 * @throws {ActionError} NOT_FOUND si el cliente no pertenece al tenant; CREDITO_EXCEDIDO sin permiso.
 */
export async function exigirLimiteCredito(
  params: ExigirLimiteCreditoParams,
): Promise<ResultadoLimiteCredito> {
  if (params.montoRequerido <= 0) {
    return { overrideUsado: false, saldoVivo: 0, limiteCredito: null, montoEvaluado: 0 };
  }

  const cliente = await params.client.cliente.findFirst({
    where: { clienteId: params.clienteId, tenantId: params.tenantId },
    select: { limiteCredito: true },
  });
  if (!cliente) throw new ActionError('Cliente no encontrado', 'NOT_FOUND');

  if (cliente.limiteCredito == null) {
    return { overrideUsado: false, saldoVivo: 0, limiteCredito: null, montoEvaluado: params.montoRequerido };
  }

  const cuentas = await params.client.cuentaPorCobrar.findMany({
    where: { tenantId: params.tenantId, clienteId: params.clienteId, estado: { not: 'ANULADA' } },
    select: { id: true, montoDeuda: true, montoPagado: true, estado: true },
  });

  // La cuenta excluida sale del saldo vivo: el caller pasa en montoRequerido
  // el nuevo monto completo de esa deuda (reemplazo), no un delta.
  const vivas = (params.cuentaExcluidaId
    ? cuentas.filter((c) => c.id !== params.cuentaExcluidaId)
    : cuentas
  ).map((c) => ({
    montoDeuda: Number(c.montoDeuda),
    montoPagado: Number(c.montoPagado),
    estado: c.estado,
  }));

  const saldoVivo = saldoVivoCliente(vivas);
  if (
    superaLimiteCredito({
      saldoVivo,
      montoRequerido: params.montoRequerido,
      limiteCredito: cliente.limiteCredito,
    })
  ) {
    if (!hasPermission(params.user, PERMISO_CREDITO_OVERRIDE)) {
      throw new ActionError(
        `La venta a crédito supera el límite del cliente. Saldo: ${saldoVivo}, requerido: ${params.montoRequerido}, límite: ${cliente.limiteCredito}. Solicita override al manager.`,
        'CREDITO_EXCEDIDO',
      );
    }
    return {
      overrideUsado: true,
      saldoVivo,
      limiteCredito: cliente.limiteCredito,
      montoEvaluado: params.montoRequerido,
    };
  }

  return {
    overrideUsado: false,
    saldoVivo,
    limiteCredito: cliente.limiteCredito,
    montoEvaluado: params.montoRequerido,
  };
}
