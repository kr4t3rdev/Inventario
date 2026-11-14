/**
 * @description Tracking de referidos y cálculo de incentivos.
 *
 * Genera códigos de referido únicos y determina los puntos
 * que se otorgan al refiriente y al referido.
 *
 * @module features/lealtad/services/referido-engine
 */

/**
 * @description Genera un código de referido único basado en el ID del refiriente.
 * Formato: "REF-{timestamp}" para garantizar unicidad.
 * @param {string} _refirienteId - ID del cliente que refiere (reservado para personalización futura).
 * @returns {string} Código de referido único.
 */
export function generarCodigoReferido(_refirienteId: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `REF-${timestamp}-${random}`;
}

export interface IncentivoParams {
  estado: 'PENDIENTE' | 'REGISTRADO' | 'COMPRA_COMPLETADA';
  incentivoRefiriente: number;
  incentivoReferido: number;
  puntosRefiriente: boolean;
  puntosReferido: boolean;
}

export interface IncentivoResultado {
  puntosParaRefiriente: number;
  puntosParaReferido: number;
}

/**
 * @description Evalúa si se deben pagar los incentivos de un referido
 * según su estado actual y si ya fueron pagados.
 * @param {IncentivoParams} params - Estado y configuración del referido.
 * @returns {IncentivoResultado} Puntos pendientes de otorgar.
 */
export function evaluarIncentivoReferido(params: IncentivoParams): IncentivoResultado {
  const puntosParaRefiriente = (!params.puntosRefiriente && params.estado === 'COMPRA_COMPLETADA')
    ? params.incentivoRefiriente
    : 0;

  const puntosParaReferido = (!params.puntosReferido && params.estado === 'REGISTRADO')
    ? params.incentivoReferido
    : 0;

  return { puntosParaRefiriente, puntosParaReferido };
}
