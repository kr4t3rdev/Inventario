import { Prisma } from '@/generated/prisma';

type AccountType = 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'COSTO' | 'GASTO';
type AccountNature = 'DEUDORA' | 'ACREEDORA';
const LedgerDecimal = Prisma.Decimal.clone({ precision: 50 });

export interface FinancialLedgerLine {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  nature: AccountNature;
  debit: string;
  credit: string;
}

export interface FinancialAccountBalance {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  nature: AccountNature;
  balance: string;
}

/**
 * @description Suma líneas del mayor por cuenta con precisión decimal exacta.
 * @param {FinancialLedgerLine[]} lines - Líneas ya seleccionadas para el corte contable.
 * @returns {FinancialAccountBalance[]} Saldos por cuenta, ordenados por código.
 */
export function calculateLedgerBalance(lines: FinancialLedgerLine[]): FinancialAccountBalance[] {
  const accounts = new Map<string, FinancialAccountBalance>();

  for (const line of lines) {
    const debit = new LedgerDecimal(line.debit);
    const credit = new LedgerDecimal(line.credit);
    if (!debit.isFinite() || !credit.isFinite() || debit.isNegative() || credit.isNegative()) {
      throw new Error('Los importes de la línea contable no son válidos');
    }

    const previous = accounts.get(line.id);
    if (previous && (
      previous.code !== line.code || previous.name !== line.name ||
      previous.type !== line.type || previous.nature !== line.nature
    )) {
      throw new Error('Los datos de la cuenta contable son inconsistentes');
    }

    const movement = line.nature === 'DEUDORA' ? debit.sub(credit) : credit.sub(debit);
    accounts.set(line.id, {
      id: line.id,
      code: line.code,
      name: line.name,
      type: line.type,
      nature: line.nature,
      balance: new LedgerDecimal(previous?.balance ?? 0).add(movement).toString(),
    });
  }

  return [...accounts.values()].sort((left, right) => left.code.localeCompare(right.code));
}
