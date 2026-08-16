import { describe, expect, it } from 'vitest';
import { buildSaleCreateRequest, type SaleFormState } from './sales-validation';

const baseForm: SaleFormState = {
  puntoDeVentaId: 'pos-1',
  productoId: 'product-1',
  cantidad: '2',
  precioUnitario: '10',
  observaciones: 'Venta mobile',
};

describe('sale surface validation', () => {
  it('rejects empty numeric fields instead of converting them to zero', () => {
    const result = buildSaleCreateRequest({ ...baseForm, cantidad: '' });

    expect(result.request).toBeNull();
    expect(result.error).toContain('Completa');
  });

  it('matches the backend numeric constraints', () => {
    expect(buildSaleCreateRequest({ ...baseForm, cantidad: '1.5' }).request).toBeNull();
    expect(buildSaleCreateRequest({ ...baseForm, cantidad: '0' }).request).toBeNull();
    expect(buildSaleCreateRequest({ ...baseForm, precioUnitario: '-1' }).request).toBeNull();
  });

  it('builds the existing sale create contract', () => {
    expect(buildSaleCreateRequest(baseForm).request).toEqual({
      puntoDeVentaId: 'pos-1',
      items: [{ productoId: 'product-1', cantidad: 2, precioUnitario: 10 }],
      observaciones: 'Venta mobile',
    });
  });
});
