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
 * @description Identifica tasas sin procedencia que el contrato de borrador no puede conservar.
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
