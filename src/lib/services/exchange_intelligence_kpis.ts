/**
 * @fileoverview Funciones de cálculo de KPIs para Exchange Intelligence Dashboard
 * Implementa los cálculos de KPIs definidos en tasks.md (tareas 10.1 a 10.8)
 */

import { RealMargin, ExchangeDifferential, DebtPriority } from "@/lib/types/exchange-intelligence";

/**
 * @description Calcula la tasa de equilibrio para un producto
 * @param precio_venta - Precio de venta del producto
 * @param gastos_fijos - Gastos fijos asociados
 * @param costo_divisa - Costo en moneda extranjera
 * @returns Tasa de equilibrio o null si no es calculable
 * @requires 4.1, 4.3
 */
export function calculate_break_even_rate(
  precio_venta: number,
  gastos_fijos: number,
  costo_divisa: number
): number | null {
  if (costo_divisa === 0) {
    return null; // Manejo de división por cero
  }

  const tasa_equilibrio = (precio_venta - gastos_fijos) / costo_divisa;

  if (tasa_equilibrio < 0) {
    return null; // Producto no rentable
  }

  return tasa_equilibrio;
}

/**
 * @description Clasifica un producto según su proximidad a la tasa de equilibrio
 * @param proximidad_porcentaje - Porcentaje de proximidad a la tasa de equilibrio
 * @returns Clasificación: seguro, advertencia o crítico
 * @requires 4.3
 */
export function clasificar_proximidad_equilibrio(
  proximidad_porcentaje: number
): 'seguro' | 'advertencia' | 'critico' {
  const abs_proximidad = Math.abs(proximidad_porcentaje);
  
  if (abs_proximidad > 100) return 'critico';
  if (abs_proximidad > 10) return 'advertencia';
  return 'seguro';
}

/**
 * @description Calcula el margen real vs nominal para un producto
 * @param precio_venta - Precio de venta del producto
 * @param costo_original - Costo original en moneda local
 * @param tasa_actual - Tasa de cambio actual
 * @param tasa_original - Tasa de cambio original al momento de la compra
 * @returns Objeto con márgenes nominal, real y diferencia porcentual
 * @requires 5.1, 5.2, 5.4
 */
export function calculate_real_margin(
  precio_venta: number,
  costo_original: number,
  tasa_actual: number,
  tasa_original: number
): RealMargin {
  // Margen nominal: precio_venta - costo_original
  const margen_nominal = precio_venta - costo_original;

  // Calcular costo ajustado por tasa actual
  // costo_ajustado = costo_original * (tasa_actual / tasa_original)
  const factor_ajuste = tasa_original > 0 ? tasa_actual / tasa_original : 1;
  const costo_ajustado = costo_original * factor_ajuste;

  // Margen real: precio_venta - costo_ajustado
  const margen_real = precio_venta - costo_ajustado;

  // Diferencia porcentual entre margen nominal y real
  let diferencia_porcentual = 0;
  if (margen_nominal !== 0) {
    diferencia_porcentual = ((margen_real - margen_nominal) / Math.abs(margen_nominal)) * 100;
  }

  return {
    producto_id: '',
    margen_nominal,
    costo_ajustado,
    margen_real,
    diferencia_porcentual,
  };
}

/**
 * @description Genera tendencia histórica de márgenes
 * @param historico_margenes - Array de márgenes históricos
 * @returns Tendencia histórica formateada
 */
export function generar_tendencia_historica(
  historico_margenes: Array<{
    fecha: Date;
    margen_nominal: number;
    margen_real: number;
  }>
): Array<{
  fecha: string;
  margen_nominal: number;
  margen_real: number;
}> {
  return historico_margenes.map((m) => ({
    fecha: m.fecha.toISOString().split('T')[0],
    margen_nominal: m.margen_nominal,
    margen_real: m.margen_real,
  })).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * @description Calcula el diferencial cambiario para una transacción
 * @param tasa_actual - Tasa de cambio actual
 * @param tasa_original - Tasa de cambio original
 * @param monto - Monto de la transacción
 * @returns Diferencial cambiario en valores absolutos
 */
export function calculate_exchange_differential_single(
  tasa_actual: number,
  tasa_original: number,
  monto: number
): number {
  if (tasa_original === 0) return 0;
  return Math.abs((tasa_actual - tasa_original) * monto);
}

/**
 * @description Acumula diferencial cambiario y genera desglose mensual
 * @param transacciones - Array de transacciones con tasas y montos
 * @param anio_fiscal - Año fiscal para filtrar
 * @returns Diferencial YTD, desglose mensual y comparación con año anterior
 * @requires 6.1, 6.4, 6.6
 */
export function calculate_exchange_differential(
  transacciones: Array<{
    fecha: Date;
    tasa: number;
    tasa_original?: number;
    monto: number;
    moneda: string;
  }>,
  anio_fiscal: number
): ExchangeDifferential {
  // Filtrar transacciones del año fiscal
  const transacciones_anio = transacciones.filter(
    (tx) => tx.fecha.getFullYear() === anio_fiscal
  );

  // Filtrar transacciones del año anterior
  const transacciones_anio_anterior = transacciones.filter(
    (tx) => tx.fecha.getFullYear() === anio_fiscal - 1
  );

  // Calcular YTD
  let ytd = 0;
  for (const tx of transacciones_anio) {
    // Usar la tasa original de la transacción (asimilación a tasa de registro)
    const tasa_original_tx = tx.tasa_original || tx.tasa;
    ytd += calculate_exchange_differential_single(tx.tasa, tasa_original_tx, tx.monto);
  }

  // Generar desglose mensual
  const desglose_mensual: Array<{ mes: string; diferencial: number }> = [];
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const mensual_map = new Map<number, number>();
  for (const tx of transacciones_anio) {
    const tasa_original_tx = tx.tasa_original || tx.tasa;
    const mes = tx.fecha.getMonth();
    const diferencial = calculate_exchange_differential_single(tx.tasa, tasa_original_tx, tx.monto);
    mensual_map.set(mes, (mensual_map.get(mes) || 0) + diferencial);
  }

  for (let i = 0; i < 12; i++) {
    desglose_mensual.push({
      mes: meses[i],
      diferencial: mensual_map.get(i) || 0,
    });
  }

  // Calcular comparacion con año anterior
  let ytd_anio_anterior = 0;
  for (const tx of transacciones_anio_anterior) {
    const tasa_original_tx = tx.tasa_original || tx.tasa;
    ytd_anio_anterior += calculate_exchange_differential_single(tx.tasa, tasa_original_tx, tx.monto);
  }

  const comparacion_anio_anterior = ytd_anio_anterior > 0 
    ? ((ytd - ytd_anio_anterior) / ytd_anio_anterior) * 100 
    : 0;

  return {
    periodo: `${anio_fiscal}`,
    ingresos_nominales: 0,
    ingresos_ajustados: 0,
    gastos_nominales: 0,
    gastos_ajustados: 0,
    diferencial: ytd,
    desglose_mensual,
    comparacion_anio_anterior,
  };
}

/**
 * @description Calcula la prioridad de una deuda basada en antigüedad y tendencia de moneda
 * @param antiguedad_dias - Antigüedad de la deuda en días
 * @param monto - Monto de la deuda
 * @param tendencia_30d - Cambio porcentual de la moneda en los últimos 30 días
 * @returns Score de prioridad entre 0 y 1
 * @requires 7.1, 7.2, 7.4, 7.6
 */
export function calculate_debt_priority_score(
  antiguedad_dias: number,
  monto: number,
  tendencia_30d: number
): number {
  // Factor de antigüedad: más días = mayor prioridad (0 a 0.3)
  const factor_antiguedad = Math.min(0.3, (antiguedad_dias / 365) * 0.3);

  // Factor de tendencia: moneda alcista = mayor prioridad (0 a 0.7)
  // Si la moneda sube, conviene pagar antes
  const factor_tendencia = Math.min(0.7, Math.abs(tendencia_30d / 100) * 0.7);

  // Score de prioridad
  const score = factor_antiguedad + factor_tendencia;

  return Math.max(0, Math.min(1, score));
}

/**
 * @description Calcula el impacto de pagar una deuda hoy vs en 30 días
 * @param monto - Monto de la deuda
 * @param tendencia_30d - Cambio porcentual proyectado en 30 días
 * @returns Impacto estimado de pagar hoy vs 30 días
 * @requires 7.6
 */
export function calculate_debt_impact_30d(
  monto: number,
  tendencia_30d: number
): number {
  // Impacto = monto * (tendencia_30d / 100)
  return monto * (tendencia_30d / 100);
}

/**
 * @description Calcula la tendencia de una moneda en los últimos 30 días
 * @param tasa_actual - Tasa actual
 * @param tasa_30dias_atras - Tasa hace 30 días
 * @returns Cambio porcentual
 * @requires 7.2
 */
export function calculate_currency_trend(
  tasa_actual: number,
  tasa_30dias_atras: number
): number {
  if (tasa_30dias_atras === 0) return 0;
  return ((tasa_actual - tasa_30dias_atras) / tasa_30dias_atras) * 100;
}

/**
 * @description Determina la tendencia de una moneda
 * @param cambio_porcentual - Cambio porcentual de la moneda
 * @returns Tendencia: alcista, bajista o estable
 * @requires 7.2
 */
export function classify_currency_trend(
  cambio_porcentual: number
): 'alcista' | 'bajista' | 'estable' {
  if (cambio_porcentual > 2) return 'alcista';
  if (cambio_porcentual < -2) return 'bajista';
  return 'estable';
}

/**
 * @description Calcula la priorización de deudas por antigüedad y riesgo cambiario
 * @param deudas - Array de deudas con datos
 * @param tasas_historicas - Mapa de tasas históricas por fecha y moneda
 * @param fecha_corte - Fecha de corte para el cálculo
 * @returns Array de deudas ordenadas por prioridad
 * @requires 7.1, 7.2, 7.4, 7.6
 */
export function calculate_debt_priority(
  deudas: Array<{
    id: string;
    monto: number;
    moneda: string;
    fecha_registro: Date;
  }>,
  tasas_historicas: Map<string, Map<string, number>>,
  fecha_corte: Date
): DebtPriority[] {
  const resultado: DebtPriority[] = [];

  for (const deuda of deudas) {
    // Calcular antigüedad
    const antiguedad_dias = Math.floor(
      (fecha_corte.getTime() - deuda.fecha_registro.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calcular tendencia de la moneda (últimos 30 días)
    const fecha_30dias_atras = new Date(fecha_corte);
    fecha_30dias_atras.setDate(fecha_30dias_atras.getDate() - 30);

    const tasa_actual = tasas_historicas.get(deuda.moneda)?.get(fecha_corte.toISOString().split('T')[0]) || 1;
    const tasa_30dias = tasas_historicas.get(deuda.moneda)?.get(fecha_30dias_atras.toISOString().split('T')[0]) || 1;

    const tendencia_30d = calculate_currency_trend(tasa_actual, tasa_30dias);

    // Calcular score de prioridad
    const score_prioridad = calculate_debt_priority_score(
      antiguedad_dias,
      deuda.monto,
      tendencia_30d
    );

    // Calcular impacto de pagar hoy vs 30 días
    const impacto_30d = calculate_debt_impact_30d(deuda.monto, tendencia_30d);

    resultado.push({
      deuda_id: deuda.id,
      monto: deuda.monto,
      moneda: deuda.moneda,
      antiguedad_dias,
      tendencia_30d,
      score_prioridad,
    });
  }

  // Ordenar por prioridad descendente
  resultado.sort((a, b) => b.score_prioridad - a.score_prioridad);

  return resultado;
}
