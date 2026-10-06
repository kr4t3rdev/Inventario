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

    const [cxcs, cxps] = await Promise.all([
      prisma.cuentaPorCobrar.findMany({
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
      prisma.cuentaPorPagar.findMany({
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

    const antes = await prisma.cashSnapshot.count({ where: { tenantId, fechaCorte } });
    if (filas.length > 0) {
      await prisma.cashSnapshot.createMany({ data: filas, skipDuplicates: true });
    }
    const despues = await prisma.cashSnapshot.count({ where: { tenantId, fechaCorte } });
    const creados = despues - antes;

    return {
      tenantId,
      fechaCorte,
      creados,
      existentes: filas.length - creados,
      omitidos,
    };
  },

  /** @description Lee los snapshots de un corte para auditoría/conciliación. */
  async leerCorte(tenantId: string, fechaCorte: Date) {
    return prisma.cashSnapshot.findMany({
      where: { tenantId, fechaCorte: inicioDiaUTC(fechaCorte) },
      orderBy: [{ tipo: 'asc' }, { origenId: 'asc' }],
    });
  },
};
