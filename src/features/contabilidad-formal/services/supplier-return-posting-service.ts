import { buildFunctionalValuation } from '../lib/functional-valuation';
import {
  postEvento,
  type ContextoPosting,
  type EventoContableInput,
  type PostEventoResult,
  type PostingTx,
} from './posting-engine';

export interface SupplierReturnPostingParams {
  devolucionId: string;
  fecha: Date;
  montoTotal: number;
  montoImputado: number;
  montoImputadoFuncional?: number | null;
  saldoAFavor: number;
  moneda: string;
  tasaCambio?: number | null;
}

/** Origen idempotente de la devolución de compra. */
export const DEVOLUCION_COMPRA_ORIGIN_TYPE = 'devolucion_compra';

/**
 * @description Reconstruye de forma pura el evento formal de devolución a proveedor.
 * @param {SupplierReturnPostingParams} params - Importes operativos persistidos.
 * @param {string | null} functionalCurrency - Moneda funcional del tenant.
 * @returns {EventoContableInput} Evento listo para postear o reproducir.
 */
export function construirEventoDevolucionCompra(
  params: SupplierReturnPostingParams,
  functionalCurrency: string | null,
): EventoContableInput {
  const moneda = params.moneda.trim().toUpperCase();
  const valuation = buildFunctionalValuation({
    monto: params.montoTotal,
    moneda,
    functionalCurrency,
    tasaCambio: params.tasaCambio,
    fechaOperacion: params.fecha,
    source: 'supplier-return-posting-service',
  });
  const montoTotalFuncional = valuation.sameCurrency ? params.montoTotal : valuation.montoConvertido;
  const montoImputadoFuncional = params.montoImputadoFuncional ?? (
    montoTotalFuncional == null
      ? null
      : params.montoTotal > 0
        ? montoTotalFuncional * params.montoImputado / params.montoTotal
        : 0
  );
  const saldoAFavorFuncional = montoTotalFuncional == null || montoImputadoFuncional == null
    ? null
    : montoTotalFuncional - montoImputadoFuncional;

  return {
    tipo: 'DEVOLUCION_COMPRA',
    fecha: params.fecha,
    descripcion: `Devolución a proveedor ${params.devolucionId}`,
    origen: { tipo: DEVOLUCION_COMPRA_ORIGIN_TYPE, id: params.devolucionId },
    monto: params.montoTotal,
    moneda,
    montoFuncional: montoTotalFuncional,
    monedaFuncional: functionalCurrency,
    tasaCambio: valuation.tasaCambio,
    fxEvidenceFingerprint: valuation.fxEvidenceFingerprint,
    auxiliares: {
      ...(montoImputadoFuncional == null ? {} : { montoAplicadoCxc: montoImputadoFuncional }),
      ...(saldoAFavorFuncional == null ? {} : { montoSaldoFavor: saldoAFavorFuncional }),
    },
  };
}

/**
 * @description Emite el asiento formal de una devolución a proveedor.
 * @param {PostingTx} tx - Transacción Prisma de la devolución.
 * @param {ContextoPosting} ctx - Tenant y usuario que registraron la devolución.
 * @param {SupplierReturnPostingParams} params - Montos y evidencia de moneda de la devolución.
 * @returns {Promise<PostEventoResult>} Resultado del motor contable formal.
 */
export async function emitirDevolucionCompra(
  tx: PostingTx,
  ctx: ContextoPosting,
  params: SupplierReturnPostingParams,
): Promise<PostEventoResult> {
  const policy = await tx.tenantAccountingPolicy.findUnique({
    where: { tenantId: ctx.tenantId },
    select: { functionalCurrencyCode: true },
  });
  const functionalCurrency = policy?.functionalCurrencyCode?.trim().toUpperCase() || null;
  return postEvento(tx, ctx, construirEventoDevolucionCompra(params, functionalCurrency));
}
