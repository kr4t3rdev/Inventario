import type { Prisma } from '@/generated/prisma';
import { ActionError } from '@/lib/server-actions';
import { reverseAnticipo } from '@/lib/services/anticipos-workflow';

type Tx = Prisma.TransactionClient;

type ExpenseReconciliation = {
  reconciliacionId: string;
  tenantId: string;
  referenciaId: string;
  tipoGasto: string;
  cuentaId: string;
  monto: unknown;
  montoConvertido: unknown;
  moneda: string;
  tasaCambio?: unknown;
  estado: string;
  cuentaPorPagarId: string | null;
};

type ExpenseReversalParams = {
  tenantId: string;
  referenciaId: string;
  tipoGasto: 'gastoDE' | 'servicio';
  usuarioId: string;
  cuentaPorPagarId?: string | null;
  anticipoContext?: boolean;
};

function amountToRestore(
  reconciliation: ExpenseReconciliation,
  accountCurrency: string,
): number {
  const originalAmount = Number(reconciliation.monto);
  const rate = Number(reconciliation.tasaCambio);
  if (!Number.isFinite(originalAmount) || originalAmount < 0) {
    throw new ActionError('Monto de reconciliación inválido', 'VALIDATION_ERROR');
  }

  // Payment workflow debits the account in its own currency. Rebuild that exact
  // debit from original amount + persisted FX, instead of using montoConvertido
  // (which is always normalized to CUP for reporting). If no rate was stored,
  // preserve the workflow's historical 1:1 fallback.
  const amount =
    reconciliation.moneda === accountCurrency
      ? originalAmount
      : Number.isFinite(rate) && rate > 0
        ? originalAmount * rate
        : originalAmount;
  if (!Number.isFinite(amount) || amount < 0) {
    throw new ActionError('Monto de reconciliación inválido', 'VALIDATION_ERROR');
  }
  return amount;
}

/**
 * @description Revierte efectos financieros de un gasto eliminado dentro de una transacción.
 * Los saldos se restauran con el monto persistido, nunca se recalcula FX ni se decrementan
 * cuentas. La operación debe ejecutarse después de reclamar atómicamente el documento.
 */
export async function reverseExpenseEffects(
  tx: Tx,
  params: ExpenseReversalParams,
): Promise<{ reconciliations: number; accounts: number; cuentasPorPagar: number; anticipos: number }> {
  const reconciliations = (await tx.reconciliacionGasto.findMany({
    where: {
      tenantId: params.tenantId,
      tipoGasto: params.tipoGasto,
      referenciaId: params.referenciaId,
    },
    select: {
      reconciliacionId: true,
      tenantId: true,
      referenciaId: true,
      tipoGasto: true,
      cuentaId: true,
      monto: true,
      montoConvertido: true,
      moneda: true,
      tasaCambio: true,
      estado: true,
      cuentaPorPagarId: true,
    },
  })) as ExpenseReconciliation[];

  const accountReconciliations = new Map<string, ExpenseReconciliation[]>();
  const cuentaPorPagarIds = new Set<string>();
  for (const reconciliation of reconciliations) {
    if (reconciliation.cuentaPorPagarId) cuentaPorPagarIds.add(reconciliation.cuentaPorPagarId);
    if (reconciliation.estado === 'PENDIENTE') continue;
    const current = accountReconciliations.get(reconciliation.cuentaId) ?? [];
    current.push(reconciliation);
    accountReconciliations.set(reconciliation.cuentaId, current);
  }

  let serviceInvoice: string | null = null;
  if (params.tipoGasto === 'servicio' && cuentaPorPagarIds.size > 0) {
    const service = await tx.compraServicio.findFirst({
      where: { compraServicioId: params.referenciaId, tenantId: params.tenantId },
      select: { numeroFactura: true },
    });
    serviceInvoice = service?.numeroFactura?.trim() || null;
    if (!serviceInvoice) {
      throw new ActionError('No se puede eliminar el servicio: no se pudo verificar su cuenta por pagar', 'HAS_IMPACT');
    }
  }

  const accountTotals = new Map<string, number>();
  for (const [cuentaId, accountRows] of accountReconciliations) {
    const cuenta = await tx.cuentaBancaria.findUnique({
      where: { cuentaId },
      select: { cuentaId: true, tenantId: true, moneda: true },
    });
    if (!cuenta || cuenta.tenantId !== params.tenantId) {
      throw new ActionError('Cuenta bancaria no encontrada', 'NOT_FOUND');
    }
    const amount = accountRows.reduce(
      (total, row) => total + amountToRestore(row, cuenta.moneda),
      0,
    );
    if (amount === 0) continue;
    accountTotals.set(cuentaId, amount);

    // updateMany is both tenant isolation and an atomic write. Incrementing is the
    // inverse of applyPagoGastoWorkflow, which decremented paid expenses.
    const updated = await tx.cuentaBancaria.updateMany({
      where: { cuentaId, tenantId: params.tenantId },
      data: { saldo: { increment: amount } },
    });
    if (updated.count !== 1) {
      throw new ActionError('Cuenta bancaria no encontrada', 'NOT_FOUND');
    }
  }

  if (params.cuentaPorPagarId) cuentaPorPagarIds.add(params.cuentaPorPagarId);

  let cuentasPorPagar = 0;
  for (const cuentaPorPagarId of cuentaPorPagarIds) {
    const cuenta = await tx.cuentaPorPagar.findUnique({
      where: { cuentaPorPagarId },
      select: {
        cuentaPorPagarId: true,
        tenantId: true,
        gastosDEId: true,
        tipo: true,
        numeroFactura: true,
      },
    });
    if (!cuenta) continue;
    if (cuenta.tenantId !== params.tenantId) {
      throw new ActionError('Cuenta por pagar no encontrada', 'NOT_FOUND');
    }
    if (params.tipoGasto === 'gastoDE' && cuenta.gastosDEId !== params.referenciaId) {
      throw new ActionError('Cuenta por pagar no pertenece al gasto', 'NOT_FOUND');
    }
    if (params.tipoGasto === 'servicio' && (cuenta.tipo !== 'servicio' || cuenta.numeroFactura !== serviceInvoice)) {
      throw new ActionError('Cuenta por pagar no pertenece al servicio', 'NOT_FOUND');
    }

    // Payment rows are historical effects of this source. Removing them together
    // with the debt avoids leaving an orphaned payment after hard deletion.
    await tx.pagoCuentaPorPagar.deleteMany({
      where: { tenantId: params.tenantId, cuentaPorPagarId },
    });
    cuentasPorPagar += 1;
  }

  await tx.reconciliacionGasto.deleteMany({
    where: {
      tenantId: params.tenantId,
      tipoGasto: params.tipoGasto,
      referenciaId: params.referenciaId,
    },
  });

  for (const cuentaPorPagarId of cuentaPorPagarIds) {
    await tx.cuentaPorPagar.delete({ where: { cuentaPorPagarId } });
  }

  if (tx.transaccionMoneda?.deleteMany) {
    await tx.transaccionMoneda.deleteMany({
      where: { tipoTransaccion: { in: ['gasto', 'servicio'] }, referenciaId: params.referenciaId },
    });
  }

  let anticipos = 0;
  if (params.anticipoContext && tx.anticipoMovimiento?.findMany) {
    const movements = await tx.anticipoMovimiento.findMany({
      where: { documentoDestinoId: params.referenciaId },
      select: { anticipoId: true, tipoMovimiento: true, monto: true },
    });
    const netByAnticipo = new Map<string, number>();
    for (const movement of movements) {
      const current = netByAnticipo.get(movement.anticipoId) ?? 0;
      const amount = Number(movement.monto);
      netByAnticipo.set(
        movement.anticipoId,
        current + (movement.tipoMovimiento === 'REVERSO' ? -amount : amount),
      );
    }
    for (const [anticipoId, amount] of netByAnticipo) {
      if (amount <= 0) continue;
      await reverseAnticipo(tx, {
        anticipoId,
        documentoDestinoId: params.referenciaId,
        montoReverso: amount,
        usuarioId: params.usuarioId,
        observaciones: `Reversión por eliminación de ${params.tipoGasto} ${params.referenciaId}`,
      });
      anticipos += 1;
    }
  }

  return {
    reconciliations: reconciliations.length,
    accounts: accountTotals.size,
    cuentasPorPagar,
    anticipos,
  };
}
