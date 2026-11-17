import { Prisma } from '@/generated/prisma';

const Decimal = Prisma.Decimal.clone({ precision: 80 });
const AMOUNT_PATTERN = /^\d{1,30}(?:\.\d{1,2})?$/;

interface InitialBankBalance {
  cuentaContableId: string;
  moneda: string;
  saldo: string;
}

interface BankOpeningLine {
  cuentaContableId: string;
  moneda: string;
  debito: string;
  credito: string;
}

/** @description Valida y convierte un importe monetario exacto. */
function parseAmount(value: string, name: string): Prisma.Decimal {
  if (typeof value !== 'string' || !AMOUNT_PATTERN.test(value)) {
    throw new Error(`El ${name} debe ser un importe no negativo válido`);
  }
  return new Decimal(value);
}

/** @description Identifica una cuenta y moneda sin colisiones de claves. */
function groupKey(cuentaContableId: string, moneda: string): string {
  if (!cuentaContableId.trim()) throw new Error('Indique la cuenta contable');
  if (!/^[A-Z]{3,8}$/.test(moneda)) throw new Error('Indique una moneda válida');
  return JSON.stringify([cuentaContableId, moneda]);
}

/** @description Acumula un importe sin introducir diferencias de punto flotante. */
function addAmount(totals: Map<string, Prisma.Decimal>, key: string, value: Prisma.Decimal): void {
  totals.set(key, (totals.get(key) ?? new Decimal(0)).plus(value));
}

/**
 * @description Compara saldos bancarios con líneas bancarias de apertura por cuenta y moneda.
 * @param balances - Saldos operativos a la fecha de corte.
 * @param lines - Exclusivamente líneas bancarias de la apertura, sin contrapartidas.
 * @returns Confirmación si todos los importes coinciden exactamente.
 */
export function reconcileInitialBankBalances(
  balances: readonly InitialBankBalance[],
  lines: readonly BankOpeningLine[],
): { conciliado: true } {
  const bankTotals = new Map<string, Prisma.Decimal>();
  const ledgerTotals = new Map<string, Prisma.Decimal>();
  for (const balance of balances) {
    const key = groupKey(balance.cuentaContableId, balance.moneda);
    addAmount(bankTotals, key, parseAmount(balance.saldo, 'saldo'));
  }
  for (const line of lines) {
    const key = groupKey(line.cuentaContableId, line.moneda);
    const debit = parseAmount(line.debito, 'débito');
    const credit = parseAmount(line.credito, 'crédito');
    if (!credit.isZero()) throw new Error('Las líneas bancarias no admiten crédito');
    addAmount(ledgerTotals, key, debit);
  }
  const keys = new Set([...bankTotals.keys(), ...ledgerTotals.keys()]);
  for (const key of keys) {
    if (!(bankTotals.get(key) ?? new Decimal(0)).eq(ledgerTotals.get(key) ?? new Decimal(0))) {
      throw new Error('Los saldos bancarios no coinciden con las líneas de apertura');
    }
  }
  return { conciliado: true };
}
