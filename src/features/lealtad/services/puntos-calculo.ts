/**
 * @description Reglas puras de cálculo de puntos de lealtad.
 *
 * Este módulo contiene funciones deterministas sin efectos secundarios
 * para calcular los puntos que un cliente gana por una compra.
 *
 * @module features/lealtad/services/puntos-calculo
 */

/**
 * @description Calcula los puntos ganados por una compra según el programa de lealtad.
 * La fórmula base es: floor(totalCompra * puntosPorPeso).
 * Si el programa define reglas por categoría, se aplica el multiplicador.
 * @param {object} params - Parámetros del cálculo.
 * @param {number} params.totalCompra - Total de la compra en centavos.
 * @param {number} params.puntosPorPeso - Ratio de puntos por peso monetario.
 * @param {Record<string, unknown> | null} params.reglas - Reglas personalizadas del programa.
 * @param {string | undefined} params.categoriaId - Categoría principal de la compra (opcional).
 * @returns {number} Puntos ganados (siempre >= 0).
 */
export function calcularPuntosPorCompra(params: {
  totalCompra: number;
  puntosPorPeso: number;
  reglas: Record<string, unknown> | null;
  categoriaId?: string;
}): number {
  let puntos = Math.floor(params.totalCompra * params.puntosPorPeso);

  // Si hay reglas por categoría con multiplicadores, aplicar
  if (params.reglas?.categorias && params.categoriaId) {
    const catReglas = params.reglas.categorias as Record<string, unknown>;
    const catRule = catReglas[params.categoriaId] as { multiplicador?: number } | undefined;
    const multiplicador = catRule?.multiplicador;
    if (typeof multiplicador === 'number' && multiplicador > 0) {
      puntos = Math.floor(puntos * multiplicador);
    }
  }

  return Math.max(0, puntos);
}

/**
 * @description Calcula el valor monetario de un canje de puntos.
 * Fórmula: floor((puntos / puntosMinimos) * valorCanje).
 * @param {object} params - Parámetros del canje.
 * @param {number} params.puntos - Cantidad de puntos a canjear.
 * @param {number} params.puntosMinimos - Puntos mínimos para un canje.
 * @param {number} params.valorCanje - Valor monetario por bloque de puntos mínimos.
 * @returns {number} Valor del canje en centavos.
 */
export function calcularValorCanje(params: {
  puntos: number;
  puntosMinimos: number;
  valorCanje: number;
}): number {
  const bloques = Math.floor(params.puntos / params.puntosMinimos);
  return bloques * params.valorCanje;
}

/**
 * @description Verifica si un cliente tiene suficientes puntos para un canje.
 * @param {object} params - Parámetros de verificación.
 * @param {number} params.saldoActual - Saldo actual del cliente.
 * @param {number} params.puntosSolicitados - Puntos que quiere canjear.
 * @param {number} params.puntosMinimos - Puntos mínimos requeridos por canje.
 * @returns {object} Resultado con 'aprobado' y mensaje descriptivo.
 */
export function verificarCanje(params: {
  saldoActual: number;
  puntosSolicitados: number;
  puntosMinimos: number;
}): { aprobado: boolean; motivo?: string } {
  if (params.puntosSolicitados < params.puntosMinimos) {
    return {
      aprobado: false,
      motivo: `Se requieren al menos ${params.puntosMinimos} puntos para canjear`,
    };
  }
  if (params.saldoActual < params.puntosSolicitados) {
    return {
      aprobado: false,
      motivo: 'Saldo de puntos insuficiente',
    };
  }
  return { aprobado: true };
}
