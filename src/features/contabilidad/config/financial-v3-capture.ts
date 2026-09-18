/**
 * @description Feature gate explícito para nuevas capturas financieras v3.
 * La ausencia de configuración mantiene el comportamiento fail-closed: no se
 * crean snapshots nuevos ni se reactiva el escritor legacy.
 * @returns {boolean} Indica si la captura v3 está habilitada por configuración.
 */
export function isFinancialV3CaptureEnabled(): boolean {
  return process.env.FINANCIAL_V3_CAPTURE === 'true';
}
