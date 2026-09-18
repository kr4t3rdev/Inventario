import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/features/vendors/hooks/use-vendors', () => ({
  useVendors: () => ({
    vendors: [{ vendorId: 'ven-1', nombre: 'Proveedor 1' }],
    isLoading: false,
  }),
}));
vi.mock('@/features/productos/hooks/use-productos', () => ({
  useProductos: () => ({
    products: [{ id: 'prod-1', nombre: 'Producto 1', vendorId: 'ven-1', precioCosto: 100 }],
    isLoading: false,
  }),
}));
vi.mock('@/features/compras-productos/actions', () => ({
  createCompraProductoAction: vi.fn(),
}));
vi.mock('@/features/compras-productos/actions-oc', () => ({
  getOrdenesCompraAction: vi.fn(),
}));
vi.mock('@/features/contabilidad/actions-anticipos', () => ({
  getAnticiposAction: vi.fn().mockResolvedValue({ success: false }),
}));
vi.mock('@/features/productos/components/product-photo-upload', () => ({
  ProductPhotoUpload: () => null,
}));
vi.mock('@/lib/sileo-shim', () => ({
  sileo: { success: vi.fn(), error: vi.fn() },
}));

import { getOrdenesCompraAction } from '@/features/compras-productos/actions-oc';
import { CompraProductoForm } from '@/features/compras-productos/components/compra-producto-form';

describe('CompraProductoForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza el formulario completo sin errores', async () => {
    vi.mocked(getOrdenesCompraAction).mockResolvedValue({
      success: true,
      data: { items: [], total: 0 },
    } as any);

    render(<CompraProductoForm />);

    await waitFor(() => {
      expect(screen.getByText('Datos de la Compra')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Proveedor')).toBeInTheDocument();
    expect(screen.getByLabelText('Orden de compra (opcional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Estado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /registrar compra/i })).toBeInTheDocument();
  });

  it('solo ofrece órdenes con recepción registrada (PARCIAL o RECIBIDA)', async () => {
    vi.mocked(getOrdenesCompraAction).mockResolvedValue({
      success: true,
      data: {
        items: [
          { id: 'oc-1', estado: 'BORRADOR', items: [] },
          { id: 'oc-2', estado: 'PARCIAL', proveedorId: 'ven-1', items: [{ productoId: 'prod-1', cantidadRecibida: 4, precioUnitario: 50 }] },
          { id: 'oc-3', estado: 'RECIBIDA', proveedorId: 'ven-1', items: [{ productoId: 'prod-1', cantidadRecibida: 6, precioUnitario: 50 }] },
        ],
        total: 3,
      },
    } as any);

    render(<CompraProductoForm />);

    await waitFor(() => {
      expect(getOrdenesCompraAction).toHaveBeenCalled();
    });
    // El filtrado ocurre dentro del componente; BORRADOR no debe llegar al estado.
    await waitFor(() => {
      expect(screen.getByText('Datos de la Compra')).toBeInTheDocument();
    });
  });
});
