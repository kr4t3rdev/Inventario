import { describe, expect, it } from 'vitest';

import { getReportCapabilities } from './report-capabilities';

describe('getReportCapabilities', () => {
  it('derives report sources from the authenticated plan features', () => {
    const capabilities = getReportCapabilities({
      planFeatures: {
        servicios: true,
        'transferencias-bancarias': true,
        'ajustes-bancarios': false,
        'inyeccion-capital': true,
        'prestamos-cash': false,
        'deudas-cash': true,
      },
    } as never);

    expect(capabilities).toEqual({
      includeServicios: true,
      includeTransfers: true,
      includeAdjustments: false,
      includeCapital: true,
      includePrestamosCash: false,
      includeDeudasCash: true,
    });
  });
});
