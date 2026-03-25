import { describe, expect, it } from 'vitest';
import { buildPreciosPayload } from '../precios-payload';

describe('buildPreciosPayload', () => {
  it('construye payload válido y descarta entradas vacías/no numéricas', () => {
    const payload = buildPreciosPayload({
      'lp-1': '250',
      'lp-2': '',
      'lp-3': 'abc',
      'lp-4': '99.5',
    });

    expect(payload).toEqual([
      { listaPrecioId: 'lp-1', precio: 250 },
      { listaPrecioId: 'lp-4', precio: 99.5 },
    ]);
  });
});
