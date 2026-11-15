/**
 * @description Calculador de Customer Lifetime Value (CLV).
 *
 * Estima el valor total que un cliente generará durante su relación
 * con el negocio, basado en historial de compras y proyecciones.
 *
 * @module features/cliente-analytics/services/clv-calculator
 */

export interface CLVInput {
  ticketPromedio: number; // centavos
  frecuenciaAnual: number; // compras por año
  margenBruto: number; // porcentaje (0.25 = 25%)
  vidaEsperadaAnios: number; // años de relación esperada
  totalGastado: number; // centavos históricos
  totalCompras: number;
  diasDesdePrimeraCompra: number;
}

export interface CLVResult {
  clvHistorico: number; // CLV basado en datos reales
  clvProyectado: number; // CLV proyectado a 12 meses
  clvVidaTotal: number; // CLV total esperado
  tasaDecaimiento: number; // factor de decaimiento anual
}

/**
 * @description Calcula el CLV de un cliente con múltiples métricas.
 * @param {CLVInput} input - Datos del cliente.
 * @returns {CLVResult} CLV histórico, proyectado y total.
 */
export function calcularCLV(input: CLVInput): CLVResult {
  const { ticketPromedio, frecuenciaAnual, margenBruto, vidaEsperadaAnios, totalGastado, totalCompras, diasDesdePrimeraCompra } = input;

  // CLV Histórico: valor real generado
  const clvHistorico = totalGastado * margenBruto;

  // Tasa de decaimiento: cuánta frecuencia se pierde por año
  const tasaDecaimiento = calcularTasaDecaimiento(frecuenciaAnual, diasDesdePrimeraCompra);

  // CLV proyectado a 12 meses
  const clvProyectado = ticketPromedio * frecuenciaAnual * margenBruto;

  // CLV total de vida: suma geométrica con decaimiento
  const clvVidaTotal = calcularCLVVidaTotal(clvProyectado, vidaEsperadaAnios, tasaDecaimiento);

  return {
    clvHistorico: Math.round(clvHistorico),
    clvProyectado: Math.round(clvProyectado),
    clvVidaTotal: Math.round(clvVidaTotal),
    tasaDecaimiento,
  };
}

/**
 * @description Calcula la tasa de decaimiento anual del cliente.
 * @param {number} frecuenciaAnual - Compras por año.
 * @param {number} diasDesdePrimeraCompra - Días desde primera compra.
 * @returns {number} Tasa de decaimiento (0.8 = 80% retención anual).
 */
export function calcularTasaDecaimiento(frecuenciaAnual: number, diasDesdePrimeraCompra: number): number {
  if (diasDesdePrimeraCompra <= 0) return 0.9;

  const anosActivos = diasDesdePrimeraCompra / 365;
  if (anosActivos <= 1) return 0.9; // Primer año: alta retención

  // Si la frecuencia es alta, el decaimiento es menor
  if (frecuenciaAnual >= 10) return 0.85;
  if (frecuenciaAnual >= 5) return 0.8;
  if (frecuenciaAnual >= 2) return 0.7;
  return 0.6;
}

/**
 * @description Calcula el CLV total de vida usando serie geométrica con decaimiento.
 * @param {number} clvAnual - CLV anual.
 * @param {number} anos - Años de vida esperada.
 * @param {number} tasaDecaimiento - Factor de decaimiento anual.
 * @returns {number} CLV total de vida en centavos.
 */
export function calcularCLVVidaTotal(clvAnual: number, anos: number, tasaDecaimiento: number): number {
  if (tasaDecaimiento >= 1) {
    return clvAnual * anos;
  }

  // Serie geométrica: CLV * (1 - r^n) / (1 - r)
  const n = Math.min(anos, 20); // Máximo 20 años de proyección
  const clvTotal = clvAnual * (1 - Math.pow(tasaDecaimiento, n)) / (1 - tasaDecaimiento);
  return clvTotal;
}

/**
 * @description Calcula la frecuencia anual basada en compras y tiempo activo.
 * @param {number} totalCompras - Número de compras.
 * @param {number} diasDesdePrimeraCompra - Días desde primera compra.
 * @returns {number} Frecuencia anual.
 */
export function frecuenciaAnual(totalCompras: number, diasDesdePrimeraCompra: number): number {
  if (diasDesdePrimeraCompra <= 0) return 0;
  const anos = diasDesdePrimeraCompra / 365;
  return totalCompras / Math.max(anos, 0.1);
}

/**
 * @description Calcula el CLV simplificado para dashboards rápidos.
 * @param {number} ticketPromedio - Ticket promedio en centavos.
 * @param {number} frecuenciaAnual - Compras por año.
 * @param {number} margenBruto - Margen bruto (0.25 = 25%).
 * @param {number} vidaEsperadaAnios - Años de relación.
 * @returns {number} CLV simplificado en centavos.
 */
export function clvSimplificado(
  ticketPromedio: number,
  frecuenciaAnual: number,
  margenBruto: number,
  vidaEsperadaAnios: number
): number {
  return Math.round(ticketPromedio * frecuenciaAnual * margenBruto * vidaEsperadaAnios);
}
