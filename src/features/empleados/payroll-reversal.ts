import { Prisma, EstadoCuentaPorPagar } from '@/generated/prisma';
import { ActionError } from '@/lib/server-actions';

export class PayrollDeletionError extends ActionError {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message, code);
    this.name = 'PayrollDeletionError';
  }
}

export type PayrollReconciliation = {
  reconciliacionId: string;
  pgId?: string | null;
  cuentaId: string;
  monto: unknown;
  montoConvertido: unknown;
  cuentaPorPagarId: string | null;
  estado?: string | null;
  moneda?: string | null;
  tasaCambio?: unknown;
};

type PayrollPayment = {
  pagoCuentaPorPagarId: string;
  monto: unknown;
  numeroTransaccion: string;
  observaciones?: string | null;
};

function selectPaymentsForReversal(
  payments: readonly PayrollPayment[],
  amounts: readonly number[],
  reconciliationIds: readonly string[],
): PayrollPayment[] | null {
  const hasReconciliationMarker = (observaciones: string | null | undefined, id: string) =>
    observaciones
      ?.split('|')
      .map((token) => token.trim())
      .filter((token) => token.startsWith('reconciliationIds:'))
      .some((token) => token.slice('reconciliationIds:'.length).split(',').map((value) => value.trim()).includes(id)) ?? false;
  const linked = payments.filter((payment) =>
    reconciliationIds.some(
      (id) =>
        payment.numeroTransaccion === id ||
        hasReconciliationMarker(payment.observaciones, id),
    ),
  );
  if (linked.length !== 1) return null;
  const expectedTotal = amounts.reduce((total, amount) => total + amount, 0);
  if (Math.abs(Number(linked[0].monto) - expectedTotal) <= 0.01) return linked;

  return null;
}

/**
 * @description Revierte los efectos monetarios persistidos por pagos de nómina.
 * @param {Prisma.TransactionClient} tx - Cliente Prisma transaccional.
 * @param {readonly PayrollReconciliation[]} reconciliaciones - Movimientos enlazados.
 * @param {string} tenantId - Tenant dueño de los movimientos.
 * @returns {Promise<void>} Completa la reversión o aborta toda la transacción.
 */
export async function reversePayrollReconciliations(
  tx: Prisma.TransactionClient,
  reconciliaciones: readonly PayrollReconciliation[],
  tenantId: string,
): Promise<void> {
  const accountTotals = new Map<string, number>();
  const payableTotals = new Map<string, number>();

  const activeReconciliaciones = reconciliaciones.filter(
    (reconciliation) => reconciliation.estado !== 'PENDIENTE',
  );
  const accountIds = Array.from(
    new Set(activeReconciliaciones.map((reconciliation) => reconciliation.cuentaId)),
  );
  for (const cuentaId of accountIds) {
    await tx.$queryRaw`
      SELECT 1 FROM "CuentaBancaria"
      WHERE "cuentaId" = ${cuentaId} AND "tenantId" = ${tenantId}
      FOR UPDATE
    `;
  }
  const accounts = accountIds.length
    ? await tx.cuentaBancaria.findMany({
        where: { tenantId, cuentaId: { in: accountIds } },
        select: { cuentaId: true, moneda: true },
      })
    : [];
  const accountCurrencies = new Map(accounts.map((account) => [account.cuentaId, account.moneda]));

  for (const reconciliation of activeReconciliaciones) {
    const payrollAmount = Number(reconciliation.monto);
    if (!Number.isFinite(payrollAmount) || payrollAmount < 0) {
      throw new PayrollDeletionError(
        'Monto de reconciliación inválido',
        409,
        'MONTO_RECONCILIACION_INVALIDO',
      );
    }
    const accountCurrency = accountCurrencies.get(reconciliation.cuentaId);
    if (!accountCurrency) {
      throw new PayrollDeletionError(
        `Cuenta bancaria no encontrada para revertir la reconciliación: ${reconciliation.cuentaId}`,
        409,
        'CUENTA_NO_ENCONTRADA',
      );
    }
    // Payroll payment decreases the account. Restore the exact account-currency
    // amount using the same persisted source currency/rate used by the workflow.
    const paymentCurrency = reconciliation.moneda ?? accountCurrency;
    const rate = Number(reconciliation.tasaCambio);
    const accountAmount =
      paymentCurrency === accountCurrency
        ? payrollAmount
        : Number.isFinite(rate) && rate > 0
          ? payrollAmount * rate
          : payrollAmount;
    if (!Number.isFinite(accountAmount) || accountAmount < 0) {
      throw new PayrollDeletionError(
        'Monto de reconciliación inválido',
        409,
        'MONTO_RECONCILIACION_INVALIDO',
      );
    }
    if (accountAmount === 0 && payrollAmount === 0) continue;

    accountTotals.set(
      reconciliation.cuentaId,
      (accountTotals.get(reconciliation.cuentaId) ?? 0) + accountAmount,
    );
    if (reconciliation.cuentaPorPagarId) {
      payableTotals.set(
        reconciliation.cuentaPorPagarId,
        (payableTotals.get(reconciliation.cuentaPorPagarId) ?? 0) + payrollAmount,
      );
    }
  }

  for (const [cuentaId, amount] of accountTotals) {
    const updated = await tx.cuentaBancaria.updateMany({
      where: { cuentaId, tenantId },
      data: { saldo: { increment: amount } },
    });
    if (updated.count !== 1) {
      throw new PayrollDeletionError(
        `Cuenta bancaria no encontrada para revertir la reconciliación: ${cuentaId}`,
        409,
        'CUENTA_NO_ENCONTRADA',
      );
    }
  }

  for (const [cuentaPorPagarId, amount] of payableTotals) {
    await tx.$queryRaw`
      SELECT 1 FROM "CuentaPorPagar"
      WHERE "cuentaPorPagarId" = ${cuentaPorPagarId}
      FOR UPDATE
    `;
    const payable = await tx.cuentaPorPagar.findUnique({
      where: { cuentaPorPagarId },
      select: {
        cuentaPorPagarId: true,
        tenantId: true,
        montoDeuda: true,
        montoPagado: true,
        saldoPendiente: true,
      },
    });
    if (!payable || payable.tenantId !== tenantId) {
      throw new PayrollDeletionError(
        'Cuenta por pagar no encontrada',
        409,
        'CUENTA_POR_PAGAR_NO_ENCONTRADA',
      );
    }

    const montoPagado = Number(payable.montoPagado);
    const montoDeuda = Number(payable.montoDeuda);
    const saldoPendiente = Number(payable.saldoPendiente);
    if (
      !Number.isFinite(montoPagado) ||
      !Number.isFinite(montoDeuda) ||
      !Number.isFinite(saldoPendiente) ||
      montoPagado < amount - 0.01
    ) {
      throw new PayrollDeletionError(
        'El pago de nómina ya no puede revertirse sin dejar saldo negativo',
        409,
        'SALDO_CXP_INSUFICIENTE',
      );
    }

    const nuevoMontoPagado = Math.max(0, montoPagado - amount);
    const nuevoSaldoPendiente = Math.min(
      montoDeuda,
      Math.max(0, saldoPendiente + amount),
    );
    const nuevoEstado =
      nuevoMontoPagado <= 0.01
        ? EstadoCuentaPorPagar.PENDIENTE
        : nuevoSaldoPendiente <= 0.01
          ? EstadoCuentaPorPagar.PAGADA
          : EstadoCuentaPorPagar.PARCIAL;

    const payrollPaymentAmounts = activeReconciliaciones
      .filter((reconciliation) => reconciliation.cuentaPorPagarId === cuentaPorPagarId)
      .map((reconciliation) => Number(reconciliation.monto));
    const reconciliationIds = activeReconciliaciones
      .filter((reconciliation) => reconciliation.cuentaPorPagarId === cuentaPorPagarId)
      .map((reconciliation) => reconciliation.reconciliacionId);
    const paymentRepository = tx.pagoCuentaPorPagar;
    if (paymentRepository?.findMany && paymentRepository.delete) {
      const payments = (await paymentRepository.findMany({
        where: { tenantId, cuentaPorPagarId },
        select: {
          pagoCuentaPorPagarId: true,
          monto: true,
          numeroTransaccion: true,
          observaciones: true,
        },
        orderBy: { fechaPago: 'desc' },
      })) as PayrollPayment[];
      const selectedPayments = selectPaymentsForReversal(
        payments,
        payrollPaymentAmounts,
        reconciliationIds,
      );
      if (!selectedPayments) {
        throw new PayrollDeletionError(
          'No se pudo identificar el historial de pagos de nómina para revertir',
          409,
          'HISTORIAL_PAGO_NO_IDENTIFICABLE',
        );
      }
      for (const payment of selectedPayments) {
        await paymentRepository.delete({
          where: { pagoCuentaPorPagarId: payment.pagoCuentaPorPagarId },
        });
      }
    }

    await tx.cuentaPorPagar.update({
      where: { cuentaPorPagarId },
      data: {
        montoPagado: nuevoMontoPagado,
        saldoPendiente: nuevoSaldoPendiente,
        estado: nuevoEstado,
      },
    });
  }

  const payrollIds = Array.from(
    new Set(reconciliaciones.map((reconciliation) => reconciliation.pgId).filter(Boolean)),
  ) as string[];
  if (tx.transaccionMoneda?.deleteMany && payrollIds.length > 0) {
    await tx.transaccionMoneda.deleteMany({
      where: { tipoTransaccion: 'gasto', referenciaId: { in: payrollIds } },
    });
  }
}
