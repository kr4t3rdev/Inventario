import { Prisma } from '@/generated/prisma';

const Decimal = Prisma.Decimal.clone({ precision: 80 });
const AMOUNT_PATTERN = /^\d{1,16}(?:\.\d{1,4})?$/;
type Subledger = 'CXC' | 'CXP';

interface Balance {
  tipo: Subledger;
  cuentaContableId: string;
  moneda: string;
  saldo: string;
}

interface OpeningLine {
  tipo: Subledger;
  cuentaContableId: string;
  moneda: string;
  debito: string;
  credito: string;
}

/** @description Valida un importe monetario y conserva su precisión decimal. */
function amount(value: string): Prisma.Decimal {
  if (typeof value !== 'string' || !AMOUNT_PATTERN.test(value)) {
    throw new Error('Indique un importe no negativo válido con hasta cuatro decimales');
  }
  return new Decimal(value);
}

/** @description Valida la identidad del grupo y evita compartir una cuenta entre auxiliares. */
function keyOf(item: Pick<Balance, 'tipo' | 'cuentaContableId' | 'moneda'>, types: Map<string, Subledger>): string {
  if (item.tipo !== 'CXC' && item.tipo !== 'CXP') throw new Error('Tipo de auxiliar inválido');
  if (typeof item.cuentaContableId !== 'string' || !item.cuentaContableId.trim()) {
    throw new Error('Indique la cuenta contable');
  }
  if (typeof item.moneda !== 'string' || !/^[A-Z]{3,8}$/.test(item.moneda)) {
    throw new Error('Indique una moneda válida');
  }
  const previous = types.get(item.cuentaContableId);
  if (previous && previous !== item.tipo) throw new Error('Una cuenta no puede representar ambos auxiliares');
  types.set(item.cuentaContableId, item.tipo);
  return JSON.stringify([item.tipo, item.cuentaContableId, item.moneda]);
}

/** @description Suma importes decimales del mismo grupo. */
function add(totals: Map<string, Prisma.Decimal>, key: string, value: Prisma.Decimal): void {
  totals.set(key, (totals.get(key) ?? new Decimal(0)).plus(value));
}

/**
 * @description Compara importes originales de CxC y CxP con líneas de apertura por cuenta y moneda.
 * @remarks La valoración funcional y su evidencia FX deben comprobarse por separado antes de confirmar.
 * @param balances - Saldos operativos a la fecha de corte.
 * @param lines - Solo líneas contables asignadas a CxC o CxP.
 * @returns Confirmación si todos los grupos coinciden exactamente.
 */
export function reconcileInitialSubledgers(
  balances: readonly Balance[],
  lines: readonly OpeningLine[],
): { conciliado: true } {
  const types = new Map<string, Subledger>();
  const operational = new Map<string, Prisma.Decimal>();
  const ledger = new Map<string, Prisma.Decimal>();
  for (const balance of balances) {
    add(operational, keyOf(balance, types), amount(balance.saldo));
  }
  for (const line of lines) {
    const key = keyOf(line, types);
    const debit = amount(line.debito);
    const credit = amount(line.credito);
    if (line.tipo === 'CXC' && !credit.isZero()) throw new Error('Las CxC requieren débito');
    if (line.tipo === 'CXP' && !debit.isZero()) throw new Error('Las CxP requieren crédito');
    add(ledger, key, line.tipo === 'CXC' ? debit : credit);
  }
  for (const key of new Set([...operational.keys(), ...ledger.keys()])) {
    if (!(operational.get(key) ?? new Decimal(0)).eq(ledger.get(key) ?? new Decimal(0))) {
      throw new Error('Los saldos auxiliares no coinciden con las líneas de apertura');
    }
  }
  return { conciliado: true };
}
