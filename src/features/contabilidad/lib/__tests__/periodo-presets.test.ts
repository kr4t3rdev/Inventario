import { describe, expect, it } from 'vitest';

import { getRangoPeriodo } from '../periodo-presets';

// Miércoles 12 de agosto de 2026, 15:42 local
const AHORA = new Date(2026, 7, 12, 15, 42, 0);

describe('getRangoPeriodo', () => {
  it('hoy cubre solo el día civil actual', () => {
    expect(getRangoPeriodo('hoy', AHORA)).toEqual({
      fechaInicio: '2026-08-12',
      fechaFin: '2026-08-12',
      etiqueta: 'Hoy',
    });
  });

  it('semana cubre desde el lunes hasta hoy', () => {
    expect(getRangoPeriodo('semana', AHORA)).toEqual({
      fechaInicio: '2026-08-10',
      fechaFin: '2026-08-12',
      etiqueta: 'Esta semana',
    });
  });

  it('semana en lunes devuelve solo el lunes', () => {
    const lunes = new Date(2026, 7, 10, 9, 0, 0);
    expect(getRangoPeriodo('semana', lunes)).toEqual({
      fechaInicio: '2026-08-10',
      fechaFin: '2026-08-10',
      etiqueta: 'Esta semana',
    });
  });

  it('mes cubre desde el día 1 hasta hoy', () => {
    expect(getRangoPeriodo('mes', AHORA)).toEqual({
      fechaInicio: '2026-08-01',
      fechaFin: '2026-08-12',
      etiqueta: 'Este mes',
    });
  });

  it('usa la fecha local sin desfase de zona horaria', () => {
    const medianoche = new Date(2026, 7, 12, 0, 30, 0);
    expect(getRangoPeriodo('hoy', medianoche).fechaInicio).toBe('2026-08-12');
  });
});
