import { Prisma } from '@/generated/prisma';
import type { FinancialAccountBalance } from './financial-ledger-balance';

const LedgerDecimal = Prisma.Decimal.clone({ precision: 50 });

/**
 * @description Calcula el resultado desde saldos de cuentas del intervalo solicitado.
 * @param {FinancialAccountBalance[]} accounts - Saldos formales por cuenta.
 * @returns {object} Ingresos, costos, gastos y resultado neto en formato decimal.
 */
export function calculateLedgerResult(accounts: FinancialAccountBalance[]) {
  let income = new LedgerDecimal(0);
  let costs = new LedgerDecimal(0);
  let expenses = new LedgerDecimal(0);

  for (const account of accounts) {
    if (account.type !== 'INGRESO' && account.type !== 'COSTO' && account.type !== 'GASTO') {
      continue;
    }
    const balance = new LedgerDecimal(account.balance);
    if (!balance.isFinite()) throw new Error('El saldo contable no es válido');
    const expectedNature = account.type === 'INGRESO' ? 'ACREEDORA' : 'DEUDORA';
    const signed = account.nature === expectedNature ? balance : balance.negated();
    if (account.type === 'INGRESO') income = income.add(signed);
    if (account.type === 'COSTO') costs = costs.add(signed);
    if (account.type === 'GASTO') expenses = expenses.add(signed);
  }

  return {
    income: income.toFixed(),
    costs: costs.toFixed(),
    expenses: expenses.toFixed(),
    net: income.sub(costs).sub(expenses).toFixed(),
  };
}
