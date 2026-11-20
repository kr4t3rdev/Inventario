import { Prisma, type TipoPeriodo as PrismaTipoPeriodo } from '@/generated/prisma';
import { PeriodoContableService } from '@/lib/services/periodo-contable-service';
import { EstadoPeriodo, PeriodoError, TipoPeriodo } from '@/lib/services/periodo-contable-types';
import { acquireAccountingTenantLock } from './accounting-tenant-lock-service';

export interface CutoffPeriod {
  tipo: TipoPeriodo;
  fechaInicio: Date;
  fechaFin: Date;
}

/**
 * @description Resuelve el período mensual que contiene la fecha de corte.
 * El período va del primer al último día del mes, en UTC.
 */
export function resolveCutoffPeriod(fechaCorte: string): CutoffPeriod {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaCorte);
  if (!match) throw new Error('La fecha de corte debe tener formato aaaa-mm-dd');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error('La fecha de corte no es una fecha válida');
  }
  return {
    tipo: TipoPeriodo.MENSUAL,
    fechaInicio: new Date(Date.UTC(year, month - 1, 1)),
    fechaFin: new Date(Date.UTC(year, month, 0)),
  };
}

/**
 * @description Reutiliza el período mensual abierto de la fecha de corte o lo
 * crea si no existe. Rechaza períodos cerrados y períodos que ya tienen
 * apertura. Debe llamarse dentro de la transacción de la inicialización.
 */
export async function ensureCutoffPeriod(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; fechaCorte: string; actor: string },
) {
  const { tipo, fechaInicio, fechaFin } = resolveCutoffPeriod(input.fechaCorte);
  await acquireAccountingTenantLock(tx, input.tenantId);
  const existing = await tx.periodoContable.findFirst({
    where: {
      tenantId: input.tenantId,
      tipo: tipo as unknown as PrismaTipoPeriodo,
      fechaInicio: { lte: fechaFin },
      fechaFin: { gte: fechaInicio },
    },
    orderBy: { fechaInicio: 'asc' },
  });
  if (existing) {
    if (existing.estado !== EstadoPeriodo.ABIERTO) {
      throw new PeriodoError('El período de la fecha de corte no está abierto.', 'PERIODO_CERRADO');
    }
    const apertura = await tx.aperturaPeriodo.findUnique({ where: { periodoId: existing.periodoId } });
    if (apertura) {
      throw new PeriodoError('El período ya tiene una apertura.', 'PERIODO_YA_ABIERTO');
    }
    return existing;
  }
  return PeriodoContableService.abrirPeriodo(
    { tenantId: input.tenantId, tipo, fechaInicio, fechaFin },
    input.actor,
    tx,
  );
}
