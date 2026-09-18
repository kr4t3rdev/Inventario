import { endOfDay } from 'date-fns';

/**
 * @description Determina si una fecha ISO cae dentro de un rango inclusivo.
 *   Normaliza el límite superior a fin de día para no perder los movimientos
 *   del último día seleccionado cuando `to` llega a medianoche (DateRangePicker).
 * @param {string} fecha - Fecha ISO del movimiento.
 * @param {Date} from - Límite inferior (inicio de día).
 * @param {Date} to - Límite superior del rango (se cierra a fin de día).
 * @returns {boolean} Verdadero si el movimiento pertenece al rango.
 */
export function isMovimientoInRange(fecha: string, from: Date, to: Date): boolean {
  const instante = new Date(fecha);
  return instante >= from && instante <= endOfDay(to);
}