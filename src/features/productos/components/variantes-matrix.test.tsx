import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ update: vi.fn() }));

vi.mock('@/features/productos/actions-variantes', () => ({
  updateVarianteCatalogoAction: mocks.update,
}));

import { VariantesMatrix } from './variantes-matrix';
import type { PlantillaVariantes, VarianteCatalogo } from '@/features/productos/types-variantes';

const template: PlantillaVariantes = {
  id: 'template-1',
  nombre: 'Camiseta',
  atributos: [{ nombre: 'Talla', valores: ['S', 'M'] }],
  productos: [{
    id: 'variant-m',
    nombre: 'Camiseta (M)',
    sku: 'CAM-M',
    atributoJson: { Talla: 'M' },
    precioCosto: 500,
    precioVenta: 900,
    stock: 4,
    stockTotal: 4,
  }],
};

describe('VariantesMatrix', () => {
  beforeEach(() => vi.clearAllMocks());

  it('muestra atributos y stock de la variante y permite guardar SKU y precios propios', async () => {
    mocks.update.mockResolvedValue({
      success: true,
      data: {
        id: 'variant-m',
        nombre: 'Camiseta (M)',
        sku: 'CAM-M-2',
        precioCosto: 550,
        precioVenta: 950,
        stock: 4,
      },
    });
    const onVariantUpdated = vi.fn<(producto: VarianteCatalogo) => void>();

    render(<VariantesMatrix plantilla={template} onVariantUpdated={onVariantUpdated} />);
    expect(screen.getByText('Talla: M')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('SKU de Camiseta (M)'), { target: { value: 'CAM-M-2' } });
    fireEvent.change(screen.getByLabelText('Costo de Camiseta (M)'), { target: { value: '550' } });
    fireEvent.change(screen.getByLabelText('Precio de Camiseta (M)'), { target: { value: '950' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({
      productoId: 'variant-m',
      sku: 'CAM-M-2',
      precioCosto: 550,
      precioVenta: 950,
    }));
    expect(onVariantUpdated).toHaveBeenCalledWith(expect.objectContaining({
      id: 'variant-m',
      sku: 'CAM-M-2',
      precioVenta: 950,
      stockTotal: 4,
    }));
  });
});
