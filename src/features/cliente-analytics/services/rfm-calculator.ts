/**
 * @description Algoritmo RFM (Recency, Frequency, Monetary) para segmentación
 * de clientes según comportamiento de compra.
 *
 * Recencia: días desde última compra (menor = mejor)
 * Frecuencia: número total de compras (mayor = mejor)
 * Monetario: total gastado en centavos (mayor = mejor)
 *
 * @module features/cliente-analytics/services/rfm-calculator
 */

export type ClienteRFMSegmento =
  | 'Champion'
  | 'Loyal'
  | 'At Risk'
  | 'Lost'
  | 'New'
  | 'Regular';

export interface RFMInput {
  recencia: number; // días desde última compra
  frecuencia: number; // total de compras
  monetario: number; // total gastado en centavos
}

export interface RFMScore {
  recenciaScore: number; // 1-5
  frecuenciaScore: number; // 1-5
  monetarioScore: number; // 1-5
  segmento: ClienteRFMSegmento;
  scoreLealtad: number; // 1-100
}

/**
 * @description Calcula el segmento RFM basado en recencia, frecuencia y monto.
 * @param {RFMInput} input - Datos RFM del cliente.
 * @returns {ClienteRFMSegmento} Segmento clasificado.
 */
export function calcularSegmentoRFM({ recencia, frecuencia, monetario }: RFMInput): ClienteRFMSegmento {
  // Champion: compra reciente, frecuente y alto gasto
  if (recencia <= 30 && frecuencia >= 5 && monetario >= 50000) return 'Champion';
  // Loyal: compra reciente y con frecuencia moderada
  if (recencia <= 60 && frecuencia >= 3) return 'Loyal';
  // Lost: inactivo por más de 6 meses (antes que At Risk porque es más específico)
  if (recencia > 180) return 'Lost';
  // At Risk: dejó de comprar hace 90+ días pero tenía frecuencia
  if (recencia > 90 && frecuencia >= 2) return 'At Risk';
  // New: primera compra reciente
  if (frecuencia === 1 && recencia <= 30) return 'New';
  // Regular: el resto
  return 'Regular';
}

/**
 * @description Calcula el score numérico (1-5) de la recencia.
 * Menor recencia = mejor score.
 * @param {number} recencia - Días desde última compra.
 * @returns {number} Score entre 1 y 5.
 */
export function scoreRecencia(recencia: number): number {
  if (recencia <= 14) return 5;
  if (recencia <= 30) return 4;
  if (recencia <= 60) return 3;
  if (recencia <= 90) return 2;
  return 1;
}

/**
 * @description Calcula el score numérico (1-5) de la frecuencia.
 * Mayor frecuencia = mejor score.
 * @param {number} frecuencia - Total de compras.
 * @returns {number} Score entre 1 y 5.
 */
export function scoreFrecuencia(frecuencia: number): number {
  if (frecuencia >= 10) return 5;
  if (frecuencia >= 5) return 4;
  if (frecuencia >= 3) return 3;
  if (frecuencia >= 2) return 2;
  return 1;
}

/**
 * @description Calcula el score numérico (1-5) del monto.
 * Mayor monto = mejor score.
 * @param {number} monetario - Total gastado en centavos.
 * @returns {number} Score entre 1 y 5.
 */
export function scoreMonetario(monetario: number): number {
  if (monetario >= 500000) return 5;
  if (monetario >= 200000) return 4;
  if (monetario >= 100000) return 3;
  if (monetario >= 50000) return 2;
  return 1;
}

/**
 * @description Calcula el RFM completo con scores individuales, segmento y score de lealtad.
 * @param {RFMInput} input - Datos RFM del cliente.
 * @returns {RFMScore} Scores detallados y segmento.
 */
export function calcularRFMCompleto(input: RFMInput): RFMScore {
  const recenciaScore = scoreRecencia(input.recencia);
  const frecuenciaScore = scoreFrecuencia(input.frecuencia);
  const monetarioScore = scoreMonetario(input.monetario);

  const segmento = calcularSegmentoRFM(input);

  // Score de lealtad: promedio ponderado (recencia 30%, frecuencia 30%, monetario 40%)
  // Multiplica primero por 20 para escalar 1-5 → 20-100, luego redondea
  const scoreLealtad = Math.round(
    (recenciaScore * 0.3 + frecuenciaScore * 0.3 + monetarioScore * 0.4) * 20
  );

  return {
    recenciaScore,
    frecuenciaScore,
    monetarioScore,
    segmento,
    scoreLealtad: Math.min(100, Math.max(1, scoreLealtad)),
  };
}

/**
 * @description Calcula los días desde la última compra.
 * @param {Date | null} ultimaCompra - Fecha de última compra.
 * @param {Date} ahora - Fecha de referencia (por defecto ahora).
 * @returns {number} Días transcurridos.
 */
export function diasDesdeUltimaCompra(ultimaCompra: Date | null, ahora: Date = new Date()): number {
  if (!ultimaCompra) return 9999;
  const diff = ahora.getTime() - ultimaCompra.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * @description Determina la cohorte de adquisición basada en la primera compra.
 * @param {Date} primeraCompra - Fecha de primera compra.
 * @returns {string} Cohorte en formato "YYYY-QN" (ej: "2026-Q1").
 */
export function cohorteAdquisicion(primeraCompra: Date): string {
  const year = primeraCompra.getFullYear();
  const quarter = Math.floor(primeraCompra.getMonth() / 3) + 1;
  return `${year}-Q${quarter}`;
}

/**
 * @description Calcula el ticket promedio de un cliente.
 * @param {number} totalGastado - Total gastado en centavos.
 * @param {number} totalCompras - Número de compras.
 * @returns {number | null} Ticket promedio en centavos o null si no hay compras.
 */
export function ticketPromedio(totalGastado: number, totalCompras: number): number | null {
  if (totalCompras === 0) return null;
  return Math.round(totalGastado / totalCompras);
}

/**
 * @description Calcula la tasa de recompra de un cliente.
 * @param {number} totalCompras - Número total de compras.
 * @returns {number} Tasa de recompra (0-1).
 */
export function repeatPurchaseRate(totalCompras: number): number {
  if (totalCompras <= 1) return 0;
  return Math.min(1, (totalCompras - 1) / totalCompras);
}
