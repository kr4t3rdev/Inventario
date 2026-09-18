import { describe, expect, it } from 'vitest';
import { createVentaSchema } from './schemas';

describe('createVentaSchema', () => {
  it('preserves a non-negative transport charge for invoiced sales', () => {
    const result = createVentaSchema.parse({
      puntoDeVentaId: 'pv-1',
      items: [{ productoId: 'product-1', cantidad: 1, precioUnitario: 100 }],
      cargoTransporte: 25,
    });

    expect(result.cargoTransporte).toBe(25);
  });

  it('rejects a negative transport charge', () => {
    expect(() =>
      createVentaSchema.parse({
        puntoDeVentaId: 'pv-1',
        items: [{ productoId: 'product-1', cantidad: 1, precioUnitario: 100 }],
        cargoTransporte: -1,
      }),
    ).toThrow();
  });
});
