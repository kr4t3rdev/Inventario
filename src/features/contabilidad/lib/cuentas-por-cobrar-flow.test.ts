import { describe, expect, it } from 'vitest';

import type { VentaPendiente } from '@/app/models/model';

import {
  buildCreateCuentaPorCobrarInputFromVenta,
  canCreateCuentaPorCobrarFromVenta,
} from './cuentas-por-cobrar-flow';

function buildVenta(overrides: Partial<VentaPendiente> = {}): VentaPendiente {
  return {
    ventaId: 'venta-1',
    cantidad: 1,
    puntoDeVentaId: 'pv-1',
    cliente: {
      clienteId: 'cliente-1',
      nombre: 'Cliente Test',
    },
    total: 1250,
    createdAt: '2026-07-05T10:00:00.000Z',
    updatedAt: '2026-07-05T10:00:00.000Z',
    reconciliada: false,
    montoTotal: 1250,
    saldoPendiente: 500,
    ordenId: 'FAC-100',
    moneda: 'CUP',
    ...overrides,
  };
}

describe('canCreateCuentaPorCobrarFromVenta', () => {
  it('permite crear CxC cuando el tenant tiene la feature y la venta no tiene CxC', () => {
    expect(
      canCreateCuentaPorCobrarFromVenta(buildVenta(), true, false),
    ).toBe(true);
  });

  it('bloquea cuando ya existe una CxC asociada o falta cliente', () => {
    expect(
      canCreateCuentaPorCobrarFromVenta(buildVenta(), true, true),
    ).toBe(false);
    expect(
      canCreateCuentaPorCobrarFromVenta(
        buildVenta({ cliente: { nombre: 'Sin ID' } }),
        true,
        false,
      ),
    ).toBe(false);
  });
});

describe('buildCreateCuentaPorCobrarInputFromVenta', () => {
  it('usa el saldo pendiente como monto inicial de la CxC', () => {
    const payload = buildCreateCuentaPorCobrarInputFromVenta(buildVenta());

    expect(payload).toEqual({
      ventaId: 'venta-1',
      clienteId: 'cliente-1',
      monto: 500,
      moneda: 'CUP',
      numeroFactura: 'FAC-100',
      fechaVencimiento: null,
    });
  });
});
