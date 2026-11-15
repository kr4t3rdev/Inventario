/**
 * @description Modelo predictivo de churn para detectar clientes en riesgo
 * de abandono basado en señales de comportamiento.
 *
 * @module features/cliente-analytics/services/churn-predictor
 */

export interface ChurnSignal {
  senal: string;
  severidad: 'baja' | 'media' | 'alta' | 'critica';
  peso: number; // 0-1
}

export interface ChurnInput {
  diasDesdeUltimaCompra: number;
  totalCompras: number;
  totalGastado: number; // centavos
  ticketPromedio: number | null; // centavos
  comprasUltimos30Dias: number;
  comprasUltimos60Dias: number;
  comprasUltimos90Dias: number;
  gastoUltimos30Dias: number; // centavos
  gastoUltimos60Dias: number; // centavos
  puntosLealtad: number;
  tierActual: string | null;
  cuponesRedimidos: number;
  misionesCompletadas: number;
}

export interface ChurnResult {
  probabilidadChurn: number; // 0-1
  senales: ChurnSignal[];
  riesgo: 'bajo' | 'medio' | 'alto' | 'critico';
  accionRecomendada: string;
}

/**
 * @description Predice la probabilidad de churn de un cliente.
 * @param {ChurnInput} input - Datos de comportamiento del cliente.
 * @returns {ChurnResult} Probabilidad, señales y recomendación.
 */
export function predecirChurn(input: ChurnInput): ChurnResult {
  const senales = detectarSenalesChurn(input);

  // Calcular probabilidad como suma ponderada de señales
  const probabilidadChurn = Math.min(1, senales.reduce((sum, s) => sum + s.peso, 0));

  // Clasificar riesgo
  let riesgo: ChurnResult['riesgo'];
  if (probabilidadChurn >= 0.8) riesgo = 'critico';
  else if (probabilidadChurn >= 0.5) riesgo = 'alto';
  else if (probabilidadChurn >= 0.25) riesgo = 'medio';
  else riesgo = 'bajo';

  // Recomendar acción
  const accionRecomendada = recomendarAccion(riesgo, senales);

  return {
    probabilidadChurn: Math.round(probabilidadChurn * 10000) / 10000,
    senales,
    riesgo,
    accionRecomendada,
  };
}

/**
 * @description Detecta las señales de churn de un cliente.
 * @param {ChurnInput} input - Datos de comportamiento.
 * @returns {ChurnSignal[]} Lista de señales detectadas.
 */
export function detectarSenalesChurn(input: ChurnInput): ChurnSignal[] {
  const senales: ChurnSignal[] = [];

  // Señal 1: Disminución de frecuencia
  if (input.comprasUltimos60Dias > 0 && input.comprasUltimos30Dias < input.comprasUltimos60Dias * 0.5) {
    senales.push({
      senal: 'disminucion_frecuencia',
      severidad: input.comprasUltimos30Dias === 0 ? 'alta' : 'media',
      peso: input.comprasUltimos30Dias === 0 ? 0.3 : 0.15,
    });
  }

  // Señal 2: Disminución de gasto
  if (input.gastoUltimos60Dias > 0 && input.gastoUltimos30Dias < input.gastoUltimos60Dias * 0.4) {
    senales.push({
      senal: 'disminucion_gasto',
      severidad: input.gastoUltimos30Dias === 0 ? 'alta' : 'media',
      peso: input.gastoUltimos30Dias === 0 ? 0.25 : 0.1,
    });
  }

  // Señal 3: Inactividad prolongada
  if (input.diasDesdeUltimaCompra > 90) {
    senales.push({
      senal: 'inactividad_prolongada',
      severidad: input.diasDesdeUltimaCompra > 180 ? 'critica' : 'alta',
      peso: input.diasDesdeUltimaCompra > 180 ? 0.4 : 0.2,
    });
  } else if (input.diasDesdeUltimaCompra > 60) {
    senales.push({
      senal: 'inactividad_moderada',
      severidad: 'media',
      peso: 0.1,
    });
  }

  // Señal 4: Ticket promedio en caída
  if (input.ticketPromedio && input.totalGastado > 0) {
    const ticketHistorico = input.totalGastado / Math.max(input.totalCompras, 1);
    if (input.ticketPromedio < ticketHistorico * 0.6) {
      senales.push({
        senal: 'ticket_promedio_en_caída',
        severidad: 'media',
        peso: 0.1,
      });
    }
  }

  // Señal 5: Sin engagement con lealtad
  if (input.puntosLealtad === 0 && input.tierActual === null && input.cuponesRedimidos === 0 && input.misionesCompletadas === 0) {
    senales.push({
      senal: 'sin_engagement_lealtad',
      severidad: 'baja',
      peso: 0.05,
    });
  }

  // Señal 6: Compra única
  if (input.totalCompras === 1 && input.diasDesdeUltimaCompra > 30) {
    senales.push({
      senal: 'compra_única_sin_recompra',
      severidad: 'alta',
      peso: 0.25,
    });
  }

  return senales;
}

/**
 * @description Recomienda una acción de re-engagement basada en el riesgo.
 * @param {string} riesgo - Nivel de riesgo.
 * @param {ChurnSignal[]} senales - Señales detectadas.
 * @returns {string} Acción recomendada.
 */
export function recomendarAccion(riesgo: string, senales: ChurnSignal[]): string {
  if (riesgo === 'critico') {
    return 'Enviar cupón de alto valor con mensaje personalizado de retención';
  }
  if (riesgo === 'alto') {
    const tieneDisminucion = senales.some((s) => s.senal.includes('disminucion'));
    return tieneDisminucion
      ? 'Enviar oferta de descuento progresivo para recuperar frecuencia'
      : 'Enviar cupón de bienvenida de vuelta con puntos bonus';
  }
  if (riesgo === 'medio') {
    return 'Enviar recomendación personalizada basada en historial de compra';
  }
  return 'Mantener en programa de lealtad con misiones activas';
}

/**
 * @description Verifica si un cliente está en riesgo de churn según umbral.
 * @param {ChurnInput} input - Datos de comportamiento.
 * @param {number} umbral - Umbral de probabilidad (0.5 = 50%).
 * @returns {boolean} True si el cliente está en riesgo.
 */
export function esClienteEnRiesgo(input: ChurnInput, umbral: number = 0.5): boolean {
  const resultado = predecirChurn(input);
  return resultado.probabilidadChurn >= umbral;
}
