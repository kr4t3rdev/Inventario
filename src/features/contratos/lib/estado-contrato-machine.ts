/**
 * @description Máquina de estados pura del ciclo de vida de contratos (CTF-1).
 *              Única fuente de verdad de las transiciones válidas de
 *              `Contrato.estado`. Sin Prisma: solo tipos y errores de dominio.
 * @module features/contratos/lib/estado-contrato-machine
 */
import type { EstadoContrato } from '@/generated/prisma';
import { ActionError } from '@/lib/server-actions';

/**
 * Tabla de transiciones válidas (openspec/changes/contratos-fase-2, design §1.1).
 * FINALIZADO y ANULADO son estados terminales: sin salidas.
 */
export const TRANSICIONES_VALIDAS: Record<EstadoContrato, readonly EstadoContrato[]> = {
  BORRADOR: ['PENDIENTE_APROBACION', 'ANULADO'],
  PENDIENTE_APROBACION: ['APROBADO', 'RECHAZADO', 'ANULADO'],
  RECHAZADO: ['BORRADOR', 'ANULADO'],
  APROBADO: ['ACTIVO', 'ANULADO'],
  ACTIVO: ['FINALIZADO', 'ANULADO'],
  FINALIZADO: [],
  ANULADO: [],
};

/** Estados sin transiciones salientes: un contrato allí no vuelve al flujo. */
export const ESTADOS_TERMINALES: readonly EstadoContrato[] = ['FINALIZADO', 'ANULADO'];

/**
 * @description Indica si la transición de estado es válida según la tabla.
 * @param {EstadoContrato} desde - Estado actual del contrato.
 * @param {EstadoContrato} hacia - Estado destino solicitado.
 * @returns {boolean} true si la transición está permitida.
 */
export function puedeTransicionar(desde: EstadoContrato, hacia: EstadoContrato): boolean {
  return TRANSICIONES_VALIDAS[desde].includes(hacia);
}

/**
 * @description Valida la transición y lanza ActionError si es inválida.
 * @param {EstadoContrato} desde - Estado actual del contrato.
 * @param {EstadoContrato} hacia - Estado destino solicitado.
 * @throws {ActionError} Código TRANSICION_INVALIDA con estados involucrados.
 */
export function assertTransicionValida(desde: EstadoContrato, hacia: EstadoContrato): void {
  if (!puedeTransicionar(desde, hacia)) {
    throw new ActionError(
      `No se puede cambiar un contrato de ${desde} a ${hacia}`,
      'TRANSICION_INVALIDA',
    );
  }
}
