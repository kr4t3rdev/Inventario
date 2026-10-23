/**
 * @description Servicio de snapshots funcionales cash (préstamos y deudas).
 *
 * @nota A10 (auditoría 2026-10-07): este servicio es correcto como mecanismo
 * aislado de copia (4/4 tests). Limitaciones conocidas:
 * - Está conectado al cierre de período; no sustituye una conciliación
 *   independiente ni reconstruye históricos.
 * - `fechaCorte` etiqueta el estado leído "ahora"; no hay reconstrucción histórica
 *   real por fecha pasada/futura.
 * - La captura no reconstruye la evolución histórica: solo congela el estado
 *   funcional visible en la transacción de captura.
 * No declarar comparabilidad histórica global con este servicio aislado.
 */
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';

export const CASH_SNAPSHOT_TIPO_PRESTAMO = 'PRESTAMO_CASH';
export const CASH_SNAPSHOT_TIPO_DEUDA = 'DEUDA_CASH';

export interface CapturarCashSnapshotsInput {
  tenantId: string;
  /** Día de corte (se normaliza a medianoche UTC). Por defecto: hoy. */
  fechaCorte?: Date;
  /** Período contable al que acompaña el snapshot (opcional). */
  periodoId?: string;
  /** Motivo libre: CIERRE_DIARIO | AUDITORIA | RECONCILIACION ... */
  motivo?: string;
  /**
   * Cliente transaccional opcional. Cuando se proporciona, la captura se
   * ejecuta dentro de la transacción del caller y no abre una transacción
   * anidada (por ejemplo, durante el cierre de período).
   */
  client?: Prisma.TransactionClient;
}

export interface CapturarCashSnapshotsResult {
  tenantId: string;
  fechaCorte: Date;
  /** Filas nuevas creadas. */
  creados: number;
  /** Cuentas ya snapshoteadas para este corte (idempotencia). */
  existentes: number;
  /** Cuentas omitidas por no tener montos funcionales verificables. */
  omitidos: number;
}

function inicioDiaUTC(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function yyyyMmDd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * @description Captura snapshots funcionales de las cuentas cash del tenant.
 *
 * Congela el estado funcional de cada CxC de préstamo cash (`tipoCuenta =
 * 'PRESTAMO_CASH'`) y cada CxP de deuda cash (`tipoDeuda = 'DEUDA_CASH'`) en
 * el día de corte dado. El snapshot NO reconvierte: `saldoFuncional =
 * montoDeudaFuncional - montoPagadoFuncional` tal como está persistido, junto
 * con la evidencia FX de la cuenta (`tasaCambio`, `rateEffectiveAt`,
 * `fxEvidenceFingerprint`).
 *
 * Idempotencia: una fila por (tenantId, tipo, cuenta, día de corte) vía
 * `idempotencyKey` único; repetir la captura para el mismo corte no duplica.
 * Las cuentas sin `montoDeudaFuncional` (históricos no verificables) se
 * omiten y se reportan en `omitidos`.
 */
export const CashSnapshotService = {
  async capturar(input: CapturarCashSnapshotsInput): Promise<CapturarCashSnapshotsResult> {
    const { tenantId, periodoId, motivo } = input;
    const fechaCorte = inicioDiaUTC(input.fechaCorte ?? new Date());
    const corteStr = yyyyMmDd(fechaCorte);

    const capturarEnCliente = async (tx: Prisma.TransactionClient) => {
      // Read both sources and persist their rows on the same PostgreSQL
      // snapshot. Serializable also prevents a concurrent source mutation
      // from being silently presented as part of this capture.
      const [cxcs, cxps] = await Promise.all([
        tx.cuentaPorCobrar.findMany({
          where: { tenantId, tipoCuenta: CASH_SNAPSHOT_TIPO_PRESTAMO },
          select: {
            id: true,
            montoDeudaFuncional: true,
            montoPagadoFuncional: true,
            monedaFuncional: true,
            tasaCambio: true,
            rateEffectiveAt: true,
            fxEvidenceFingerprint: true,
            prestamoCash: { select: { id: true } },
          },
        }),
        tx.cuentaPorPagar.findMany({
          where: { tenantId, tipoDeuda: CASH_SNAPSHOT_TIPO_DEUDA, deletedAt: null },
          select: {
            cuentaPorPagarId: true,
            montoDeudaFuncional: true,
            montoPagadoFuncional: true,
            monedaFuncional: true,
            tasaCambio: true,
            rateEffectiveAt: true,
            fxEvidenceFingerprint: true,
            deudaCash: { select: { id: true } },
          },
        }),
      ]);

      const filas: Prisma.CashSnapshotCreateManyInput[] = [];
      let omitidos = 0;

      for (const cxc of cxcs) {
        if (cxc.montoDeudaFuncional == null || cxc.monedaFuncional == null) {
          omitidos += 1;
          continue;
        }
        const deuda = new Prisma.Decimal(cxc.montoDeudaFuncional);
        const pagado = new Prisma.Decimal(cxc.montoPagadoFuncional ?? 0);
        const saldo = deuda.sub(pagado).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
        filas.push({
          tenantId,
          tipo: CASH_SNAPSHOT_TIPO_PRESTAMO,
          origenId: cxc.prestamoCash?.id ?? cxc.id,
          cuentaPorCobrarId: cxc.id,
          monedaFuncional: cxc.monedaFuncional,
          montoDeudaFuncional: deuda,
          montoPagadoFuncional: pagado,
          saldoFuncional: saldo,
          tasaCambio: cxc.tasaCambio,
          rateEffectiveAt: cxc.rateEffectiveAt,
          fxEvidenceFingerprint: cxc.fxEvidenceFingerprint,
          fechaCorte,
          periodoId: periodoId ?? null,
          motivo: motivo ?? null,
          idempotencyKey: `${tenantId}:${CASH_SNAPSHOT_TIPO_PRESTAMO}:${cxc.id}:${corteStr}`,
        });
      }

      for (const cxp of cxps) {
        if (cxp.montoDeudaFuncional == null || cxp.monedaFuncional == null) {
          omitidos += 1;
          continue;
        }
        const deuda = new Prisma.Decimal(cxp.montoDeudaFuncional);
        const pagado = new Prisma.Decimal(cxp.montoPagadoFuncional ?? 0);
        const saldo = deuda.sub(pagado).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
        filas.push({
          tenantId,
          tipo: CASH_SNAPSHOT_TIPO_DEUDA,
          origenId: cxp.deudaCash?.id ?? cxp.cuentaPorPagarId,
          cuentaPorPagarId: cxp.cuentaPorPagarId,
          monedaFuncional: cxp.monedaFuncional,
          montoDeudaFuncional: deuda,
          montoPagadoFuncional: pagado,
          saldoFuncional: saldo,
          tasaCambio: cxp.tasaCambio,
          rateEffectiveAt: cxp.rateEffectiveAt,
          fxEvidenceFingerprint: cxp.fxEvidenceFingerprint,
          fechaCorte,
          periodoId: periodoId ?? null,
          motivo: motivo ?? null,
          idempotencyKey: `${tenantId}:${CASH_SNAPSHOT_TIPO_DEUDA}:${cxp.cuentaPorPagarId}:${corteStr}`,
        });
      }

      const { count: creados } = filas.length > 0
        ? await tx.cashSnapshot.createMany({ data: filas, skipDuplicates: true })
        : { count: 0 };

      return {
        tenantId,
        fechaCorte,
        creados,
        existentes: filas.length - creados,
        omitidos,
      };
    };

    if (input.client) {
      return capturarEnCliente(input.client);
    }

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await prisma.$transaction(capturarEnCliente, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        const code = typeof error === 'object' && error !== null && 'code' in error
          ? error.code
          : undefined;
        if ((code === 'P2034' || code === '40P01') && attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 10));
          continue;
        }
        throw error;
      }
    }

    throw new Error('No se pudo completar la captura de snapshots cash.');
  },

  /** @description Lee los snapshots de un corte para auditoría/conciliación. */
  async leerCorte(tenantId: string, fechaCorte: Date) {
    return prisma.cashSnapshot.findMany({
      where: { tenantId, fechaCorte: inicioDiaUTC(fechaCorte) },
      orderBy: [{ tipo: 'asc' }, { origenId: 'asc' }],
    });
  },
};
