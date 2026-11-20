import { Prisma } from '@/generated/prisma';

const Decimal = Prisma.Decimal.clone({ precision: 80 });
const DECIMAL_PATTERN = /^\d{1,16}(?:\.\d{1,4})?$/;
const MAX_AMOUNT = new Decimal('9999999999999999.9999');

export interface InitialInventoryItem {
  cuentaContableId: string;
  moneda: string;
  cantidad: string;
  costoUnitario: string;
}

export interface InitialInventoryOpeningLine {
  cuentaContableId: string;
  moneda: string;
  debito: string;
  credito: string;
}

/** @description Valida un decimal dentro de la precisión admitida. */
function parseDecimal(value: string, name: string, positive: boolean): Prisma.Decimal {
  if (typeof value !== 'string' || !DECIMAL_PATTERN.test(value)) {
    throw new Error(`La cantidad o importe de ${name} es inválido`);
  }
  const result = new Decimal(value);
  if (positive && result.isZero()) throw new Error(`El ${name} debe ser mayor que cero`);
  return result;
}

/** @description Identifica la cuenta y moneda con una clave sin colisiones. */
function groupKey(cuentaContableId: string, moneda: string): string {
  if (typeof cuentaContableId !== 'string' || !cuentaContableId.trim()) {
    throw new Error('Indique la cuenta contable');
  }
  if (typeof moneda !== 'string' || !/^[A-Z]{3,8}$/.test(moneda)) {
    throw new Error('Indique una moneda válida');
  }
  return JSON.stringify([cuentaContableId, moneda]);
}

/** @description Acumula importes sin redondear ni exceder la precisión del mayor. */
function addAmount(totals: Map<string, Prisma.Decimal>, key: string, amount: Prisma.Decimal): void {
  const total = (totals.get(key) ?? new Decimal(0)).plus(amount);
  if (total.decimalPlaces() > 4 || total.greaterThan(MAX_AMOUNT)) {
    throw new Error('La valoración excede la precisión contable');
  }
  totals.set(key, total);
}

/**
 * @description Compara el costo declarado en moneda original con débitos de apertura.
 * @remarks No valida la valoración funcional ni registra fuentes FIFO; el llamador debe
 * completar ambas verificaciones antes de confirmar una apertura.
 * @param items - Existencias con cantidad y costo en la moneda indicada.
 * @param lines - Exclusivamente líneas de inventario del asiento de apertura.
 * @returns Confirmación cuando cada cuenta y moneda coincide exactamente.
 */
export function reconcileInitialInventory(
  items: readonly InitialInventoryItem[],
  lines: readonly InitialInventoryOpeningLine[],
): { conciliado: true } {
  const inventoryTotals = new Map<string, Prisma.Decimal>();
  const ledgerTotals = new Map<string, Prisma.Decimal>();
  for (const item of items) {
    const key = groupKey(item.cuentaContableId, item.moneda);
    const quantity = parseDecimal(item.cantidad, 'cantidad', true);
    const cost = parseDecimal(item.costoUnitario, 'costo unitario', false);
    const value = quantity.times(cost);
    if (value.decimalPlaces() > 4 || value.greaterThan(MAX_AMOUNT)) {
      throw new Error('La valoración excede la precisión contable');
    }
    addAmount(inventoryTotals, key, value);
  }
  for (const line of lines) {
    const key = groupKey(line.cuentaContableId, line.moneda);
    const debit = parseDecimal(line.debito, 'débito', false);
    const credit = parseDecimal(line.credito, 'crédito', false);
    if (!credit.isZero()) throw new Error('Las líneas de inventario no admiten crédito');
    addAmount(ledgerTotals, key, debit);
  }
  const keys = new Set([...inventoryTotals.keys(), ...ledgerTotals.keys()]);
  for (const key of keys) {
    if (!(inventoryTotals.get(key) ?? new Decimal(0)).equals(ledgerTotals.get(key) ?? new Decimal(0))) {
      throw new Error('El inventario no coincide con las líneas de apertura');
    }
  }
  return { conciliado: true };
}
