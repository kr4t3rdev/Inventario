import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import type { FinancialLedgerLine } from './financial-ledger-balance';
import { resolveClosingScope } from './financial-ledger-closing-scope';

interface LedgerReadParams {
  tenantId: string;
  cutoffAt: Date;
  from?: Date;
  excludeClosingEntries?: boolean;
  client?: Prisma.TransactionClient;
}

/**
 * @description Lee movimientos del tenant, conservando originales con reverso, hasta el corte.
 * @param {LedgerReadParams} params - Tenant, fecha de corte y transacción opcional.
 * @returns {Promise<FinancialLedgerLine[]>} Líneas decimales para el cálculo formal.
 */
export async function readFinancialLedger(params: LedgerReadParams): Promise<FinancialLedgerLine[]> {
  if (
    !params.tenantId.trim() || !Number.isFinite(params.cutoffAt.getTime()) ||
    (params.from && (
      !Number.isFinite(params.from.getTime()) || params.from > params.cutoffAt
    ))
  ) {
    throw new Error('El tenant y el corte contable deben ser válidos');
  }

  const db = params.client ?? prisma;
  const alcanceCierre = params.excludeClosingEntries
    ? await resolveClosingScope({ tenantId: params.tenantId, client: params.client })
    : [];

  const lines = await db.asientoLinea.findMany({
    where: {
      tenantId: params.tenantId,
      asiento: {
        tenantId: params.tenantId,
        OR: [{ estado: 'CONTABILIZADO' }, { estado: 'ANULADO', revertidoPorId: { not: null } }],
        fecha: { ...(params.from ? { gte: params.from } : {}), lte: params.cutoffAt },
        ...(alcanceCierre.length > 0 ? { asientoId: { notIn: alcanceCierre } } : {}),
      },
      cuenta: { tenantId: params.tenantId },
    },
    select: {
      cuentaId: true,
      debe: true,
      haber: true,
      cuenta: { select: { codigo: true, nombre: true, tipo: true, naturaleza: true } },
    },
  });

  return lines.map((line) => ({
    id: line.cuentaId,
    code: line.cuenta.codigo,
    name: line.cuenta.nombre,
    type: line.cuenta.tipo,
    nature: line.cuenta.naturaleza,
    debit: line.debe.toString(),
    credit: line.haber.toString(),
  }));
}
