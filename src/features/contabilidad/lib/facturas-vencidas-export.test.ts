import { describe, expect, it } from 'vitest';

import { buildFacturasVencidasTotalsRow } from './facturas-vencidas-export';

describe('buildFacturasVencidasTotalsRow', () => {
  it('alinea los totales de antigüedad con las diez columnas del CSV', () => {
    const totals = {
      dias30: 100,
      dias60: 200,
      dias90: 300,
      dias120: 400,
      diasPlus120: 500,
      total: 1500,
    };

    expect(buildFacturasVencidasTotalsRow(totals)).toEqual([
      'TOTALES', '', '', 100, 200, 300, 400, 500, 1500, '',
    ]);
  });

  it('permite recortar la última columna de días para el PDF de nueve columnas', () => {
    const row = buildFacturasVencidasTotalsRow({
      dias30: 1,
      dias60: 2,
      dias90: 3,
      dias120: 4,
      diasPlus120: 5,
      total: 15,
    });

    expect(row.slice(0, 9)).toEqual(['TOTALES', '', '', 1, 2, 3, 4, 5, 15]);
  });
});
