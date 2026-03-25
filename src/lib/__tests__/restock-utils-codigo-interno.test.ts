import { describe, expect, it } from 'vitest';

import {
  determineProductInstanceNeed,
  executeProductInstanceCreationWorkflow,
} from '@/lib/restock-utils';

const baseProduct = {
  id: 'prod-1',
  nombre: 'Producto Test',
  descripcion: 'Producto con código',
  codigoInterno: '12345678901',
  precioCosto: 100,
  precioVenta: 150,
  stock: 20,
  fotos: [],
  categoriaId: 'cat-1',
  unidadId: 'unit-1',
  vendorId: 'vendor-1',
  almacenId: 'alm-1',
  puntoDeVentaId: null,
};

describe('restock-utils - propagación de codigoInterno', () => {
  it('determineProductInstanceNeed debe conservar codigoInterno en newInstanceData', () => {
    const result = determineProductInstanceNeed({
      currentProduct: baseProduct,
      newCostPrice: 120,
    });

    expect(result.needsNewInstance).toBe(true);
    if (result.needsNewInstance) {
      expect(result.newInstanceData.codigoInterno).toBe('12345678901');
    }
  });

  it('executeProductInstanceCreationWorkflow debe mantener codigoInterno en nueva instancia', () => {
    const result = executeProductInstanceCreationWorkflow({
      currentProduct: baseProduct,
      restockQuantity: 5,
      newCostPrice: 110,
      newSellingPrice: 160,
    });

    expect(result.needsNewInstance).toBe(true);
    expect(result.newInstance?.data.codigoInterno).toBe('12345678901');
    expect(result.newInstance?.stock).toBe(5);
  });
});

