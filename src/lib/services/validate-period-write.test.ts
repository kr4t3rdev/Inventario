import { describe, expect, it } from 'vitest';

import { extraerFechaDeBody } from './validate-period-write';

describe('extraerFechaDeBody', () => {
  it('usa el inicio del período cuando no hay fecha explícita', () => {
    expect(extraerFechaDeBody({ periodo: '2026-08' })).toEqual(new Date('2026-08-01T00:00:00.000Z'));
  });

  it('prioriza la fecha explícita sobre el período', () => {
    const fecha = '2026-08-31T18:30:00.000Z';
    expect(extraerFechaDeBody({ periodo: '2026-08', fechaReconciliacion: fecha })).toEqual(new Date(fecha));
  });

  it('ignora un período con mes inválido', () => {
    expect(extraerFechaDeBody({ periodo: '2026-13' })).toBeNull();
  });
});
