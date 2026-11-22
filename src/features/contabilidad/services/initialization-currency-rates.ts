export interface OpeningAccountCurrencyInput {
  moneda: string;
  saldoInicial: string;
  tasaCambio: string;
  origen?: string;
}

/**
 * @description Encuentra monedas con más de una tasa declarada en las cuentas bancarias.
 * @param accounts - Cuentas y tasas declaradas por fila.
 * @param monedaFuncional - Moneda de presentación de la apertura.
 * @returns Códigos de moneda que requieren unificar la tasa bancaria.
 */
export function findOpeningCurrencyRateConflicts(
  accounts: readonly OpeningAccountCurrencyInput[],
  monedaFuncional: string,
): string[] {
  return [...collectAccountRates(accounts, monedaFuncional)]
    .filter(([, rates]) => rates.size > 1)
    .map(([currency]) => currency);
}

/** @description Agrupa las tasas bancarias explícitas por moneda. */
function collectAccountRates(
  accounts: readonly OpeningAccountCurrencyInput[],
  monedaFuncional: string,
): Map<string, Map<string, string>> {
  const accountRates = new Map<string, Map<string, string>>();
  accounts.forEach((account) => {
    const rate = account.tasaCambio.trim();
    if (account.moneda === monedaFuncional || !rate) return;
    const values = accountRates.get(account.moneda) ?? new Map<string, string>();
    values.set(canonicalRate(rate), values.get(canonicalRate(rate)) ?? rate);
    accountRates.set(account.moneda, values);
  });
  return accountRates;
}

/** @description Normaliza la representación decimal de una tasa para compararla por valor. */
function canonicalRate(rate: string): string {
  const numeric = Number(rate);
  return Number.isFinite(numeric) ? String(numeric) : rate;
}

/**
 * @description Identifica tasas de cuentas sin procedencia que se perderían en el contrato del borrador.
 * @param accounts - Cuentas con su procedencia y tasa individual.
 * @param monedaFuncional - Moneda funcional de la apertura.
 * @returns Monedas con conflicto que impide guardar fielmente el borrador.
 */
export function findUnpersistableOpeningRateConflicts(
  accounts: readonly OpeningAccountCurrencyInput[],
  monedaFuncional: string,
): string[] {
  const conflicts = new Set(findOpeningCurrencyRateConflicts(accounts, monedaFuncional));
  return [...new Set(accounts
    .filter((account) => conflicts.has(account.moneda)
      && account.origen === 'NO_DOCUMENTADO'
      && account.tasaCambio.trim() !== '')
    .map((account) => account.moneda))];
}

/**
 * @description Resuelve las tasas globales sin ocultar diferencias entre cuentas bancarias.
 * @param accounts - Cuentas y tasas declaradas por fila.
 * @param monedaFuncional - Moneda de presentación de la apertura.
 * @param explicitRates - Tasas globales explícitas que ya existen en el borrador.
 * @returns Tasas globales compatibles con las tasas de las cuentas.
 */
export function resolveOpeningCurrencyRates(
  accounts: readonly OpeningAccountCurrencyInput[],
  monedaFuncional: string,
  explicitRates: Record<string, string> = {},
): Record<string, string> {
  const rates = { ...explicitRates };
  const accountRates = collectAccountRates(accounts, monedaFuncional);
  accountRates.forEach((values, currency) => {
    if (values.size === 1) rates[currency] = [...values.values()][0];
    else delete rates[currency];
  });
  return rates;
}

/**
 * @description Calcula subtotales bancarios con la misma prioridad de tasas que usa la apertura.
 * @param accounts - Cuentas con saldo y posible tasa individual.
 * @param monedaFuncional - Moneda de presentación de la apertura.
 * @param rates - Tasas globales que recibirá el servidor.
 * @returns Subtotales por moneda y total funcional, o null si falta valoración.
 */
export function calculateOpeningAccountTotals(
  accounts: readonly OpeningAccountCurrencyInput[],
  monedaFuncional: string,
  rates: Record<string, string> = {},
): { porMoneda: Array<{ moneda: string; total: number }>; funcional: number | null } {
  const porMoneda = new Map<string, number>();
  let funcional = 0;
  let sinValorar = false;
  accounts.forEach((account) => {
    const saldo = Number(account.saldoInicial);
    if (!Number.isFinite(saldo)) return;
    porMoneda.set(account.moneda, (porMoneda.get(account.moneda) ?? 0) + saldo);
    if (account.moneda === monedaFuncional) {
      funcional += saldo;
      return;
    }
    if (saldo === 0) return;
    const rateText = rates[account.moneda] ?? account.tasaCambio;
    const rate = Number(rateText);
    if (!rateText.trim() || !Number.isFinite(rate) || rate <= 0) {
      sinValorar = true;
      return;
    }
    funcional += multiplyAndRoundToFour(account.saldoInicial, rateText);
  });
  return {
    porMoneda: [...porMoneda.entries()].map(([moneda, total]) => ({ moneda, total })),
    funcional: sinValorar || findOpeningCurrencyRateConflicts(accounts, monedaFuncional).length > 0
      ? null
      : funcional,
  };
}

/** @description Multiplica decimales como enteros y redondea por fila a cuatro posiciones. */
function multiplyAndRoundToFour(amount: string, rate: string): number {
  const left = decimalParts(amount);
  const right = decimalParts(rate);
  if (!left || !right) return Number((Number(amount) * Number(rate)).toFixed(4));

  const product = multiplyDigits(left.digits, right.digits);
  const scale = left.scale + right.scale;
  const decimalPlacesToRemove = Math.max(0, scale - 4);
  const keepLength = Math.max(0, product.length - decimalPlacesToRemove);
  let roundedDigits = product.slice(0, keepLength) || '0';
  const firstRemoved = product[keepLength] ?? '0';
  if (firstRemoved >= '5') roundedDigits = incrementDigits(roundedDigits);
  if (scale < 4) roundedDigits += '0'.repeat(4 - scale);
  const normalized = roundedDigits.padStart(5, '0');
  const signed = left.negative !== right.negative ? '-' : '';
  return Number(`${signed}${normalized.slice(0, -4)}.${normalized.slice(-4)}`);
}

/** @description Convierte un decimal textual, incluso con exponente, a coeficiente y escala. */
function decimalParts(value: string): { digits: string; scale: number; negative: boolean } | null {
  const match = value.trim().match(/^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/);
  if (!match) return null;
  const fraction = match[3] ?? '';
  const exponent = Number(match[4] ?? '0');
  let digits = `${match[2]}${fraction}`.replace(/^0+(?=\d)/, '');
  let scale = fraction.length - exponent;
  if (scale < 0) {
    digits += '0'.repeat(-scale);
    scale = 0;
  }
  return { digits, scale, negative: match[1] === '-' };
}

/** @description Multiplica dos enteros decimales sin perder precisión binaria. */
function multiplyDigits(left: string, right: string): string {
  const product = Array.from({ length: left.length + right.length }, () => 0);
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      const position = i + j + 1;
      const value = product[position] + Number(left[i]) * Number(right[j]);
      product[position] = value % 10;
      product[position - 1] += Math.floor(value / 10);
    }
  }
  return product.join('').replace(/^0+(?=\d)/, '');
}

/** @description Incrementa un entero decimal representado como texto. */
function incrementDigits(value: string): string {
  const digits = value.split('');
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    if (digits[index] !== '9') {
      digits[index] = String(Number(digits[index]) + 1);
      return digits.join('');
    }
    digits[index] = '0';
  }
  return `1${digits.join('')}`;
}
