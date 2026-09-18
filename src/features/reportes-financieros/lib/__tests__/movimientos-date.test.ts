import { describe, expect, it } from 'vitest';
import { isMovimientoInRange } from '../movimientos-date';

// Se construyen las fechas en hora local y se serializan con toISOString,
// de modo que el ida-y-vuelta `new Date(fecha)` sea idéntico al instante original
// y las aserciones no dependan de la zona horaria de la máquina.
function localISO(year: number, monthIndex: number, day: number, hour = 0, minute = 0, second = 0) {
  return new Date(year, monthIndex, day, hour, minute, second).toISOString();
}

describe('isMovimientoInRange', () => {
  it('incluye un movimiento del último día del rango aunque `to` sea medianoche', () => {
    const from = new Date(2026, 7, 1); // 01/08 00:00
    const to = new Date(2026, 7, 31); // 31/08 00:00

    expect(isMovimientoInRange(localISO(2026, 7, 31, 23, 0), from, to)).toBe(true);
  });

  it('excluye movimientos anteriores al inicio del rango', () => {
    const from = new Date(2026, 7, 1);
    const to = new Date(2026, 7, 31);

    expect(isMovimientoInRange(localISO(2026, 6, 31, 23, 59), from, to)).toBe(false);
  });

  it('excluye movimientos posteriores al fin del día del límite superior', () => {
    const from = new Date(2026, 7, 1);
    const to = new Date(2026, 7, 31);

    expect(isMovimientoInRange(localISO(2026, 8, 1, 0, 1), from, to)).toBe(false);
  });
});