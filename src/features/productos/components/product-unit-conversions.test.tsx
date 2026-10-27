import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/productos/actions', () => ({
  getProductUnitConversionsAction: vi.fn(),
  createProductUnitConversionAction: vi.fn(),
  updateProductUnitConversionAction: vi.fn(),
  deleteProductUnitConversionAction: vi.fn(),
}));
vi.mock('@/lib/sileo-shim', () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));

import {
  createProductUnitConversionAction,
  deleteProductUnitConversionAction,
  getProductUnitConversionsAction,
  updateProductUnitConversionAction,
} from '@/features/productos/actions';
import { ProductUnitConversions } from './product-unit-conversions';

describe('ProductUnitConversions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getProductUnitConversionsAction).mockResolvedValue({
      success: true,
      data: {
        baseUnit: { unidadId: 'unit-each', tenantId: 'tenant-1', nombre: 'Unidad', simbolo: 'u', dimension: 'COUNT' },
        conversions: [],
        units: [{ unidadId: 'unit-box', nombre: 'Caja', simbolo: 'cj', dimension: 'COUNT' }],
      },
    } as any);
    vi.mocked(createProductUnitConversionAction).mockResolvedValue({ success: true, data: { id: 'conversion-1' } } as any);
  });

  it('submits the selected unit id and precise factor when adding a conversion', async () => {
    render(<ProductUnitConversions productId="product-1" />);

    fireEvent.click(await screen.findByRole('combobox', { name: 'Unidad de compra' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Caja (cj)' }));
    fireEvent.change(screen.getByLabelText('Factor a inventario'), { target: { value: '12.34567891' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    await waitFor(() => expect(createProductUnitConversionAction).toHaveBeenCalledWith({
      productoId: 'product-1', unidadId: 'unit-box', factorAStock: '12.34567891',
    }));
  });

  it('edits the persisted factor and invokes removal for the selected conversion', async () => {
    vi.mocked(getProductUnitConversionsAction).mockResolvedValue({
      success: true,
      data: {
        baseUnit: { unidadId: 'unit-each', tenantId: 'tenant-1', nombre: 'Unidad', simbolo: 'u', dimension: 'COUNT' },
        conversions: [{
          id: 'conversion-1',
          unidadId: 'unit-box',
          factorAStock: '12.00000000',
          unidad: { unidadId: 'unit-box', nombre: 'Caja', simbolo: 'cj' },
        }],
        units: [{ unidadId: 'unit-box', nombre: 'Caja', simbolo: 'cj', dimension: 'COUNT' }],
      },
    } as any);
    vi.mocked(updateProductUnitConversionAction).mockResolvedValue({ success: true, data: {} } as any);
    vi.mocked(deleteProductUnitConversionAction).mockResolvedValue({ success: true, data: { success: true } } as any);

    render(<ProductUnitConversions productId="product-1" />);
    const factor = await screen.findByLabelText('Factor de Caja');
    fireEvent.change(factor, { target: { value: '12.12500000' } });
    fireEvent.blur(factor);

    await waitFor(() => expect(updateProductUnitConversionAction).toHaveBeenCalledWith({
      id: 'conversion-1', productoId: 'product-1', unidadId: 'unit-box', factorAStock: '12.12500000',
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Caja' }));
    await waitFor(() => expect(deleteProductUnitConversionAction).toHaveBeenCalledWith({
      id: 'conversion-1', productoId: 'product-1',
    }));
  });
});
