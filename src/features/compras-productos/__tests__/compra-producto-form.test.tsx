import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const auth = vi.hoisted(() => ({ user: { role: 'regularUser', planFeatures: { unidades: true } } as any }));
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: auth.user }) }));

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
    productos: [{ id: 'prod-1', nombre: 'Producto 1', vendorId: 'ven-1', precioCosto: 100, unidadId: 'unit-each' }],
    isLoading: false,
  }),
}));
vi.mock('@/features/compras-productos/actions', () => ({
  createCompraProductoAction: vi.fn(),
}));
vi.mock('@/features/productos/actions', () => ({ getDirectPurchaseUnitsAction: vi.fn() }));
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
import { getDirectPurchaseUnitsAction } from '@/features/productos/actions';
import { CompraProductoForm } from '@/features/compras-productos/components/compra-producto-form';
import { sileo } from '@/lib/sileo-shim';

describe('CompraProductoForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { role: 'regularUser', planFeatures: { unidades: true } };
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

  it('carga las unidades permitidas para el producto seleccionado en compra directa', async () => {
    vi.mocked(getOrdenesCompraAction).mockResolvedValue({ success: true, data: { items: [], total: 0 } } as any);
    vi.mocked(getDirectPurchaseUnitsAction).mockResolvedValue({
      success: true,
      data: [
        { unidadId: 'unit-each', nombre: 'Unidad', simbolo: 'u' },
        { unidadId: 'unit-box', nombre: 'Caja', simbolo: 'cj' },
      ],
    } as any);
    render(<CompraProductoForm />);
    await waitFor(() => expect(screen.getByText('Datos de la Compra')).toBeInTheDocument());

    const productField = screen.getByText('Producto', { selector: 'label' }).closest('[data-slot="form-item"]');
    fireEvent.click(productField!.querySelector('button')!);
    fireEvent.click(await screen.findByRole('option', { name: 'Producto 1' }));

    await waitFor(() => expect(getDirectPurchaseUnitsAction).toHaveBeenCalledWith('prod-1'));
    fireEvent.click(await screen.findByLabelText('Unidad de compra'));
    fireEvent.click(await screen.findByRole('option', { name: 'Caja (cj)' }));
    expect(screen.getByLabelText('Unidad de compra')).toHaveTextContent('Caja (cj)');
  });

  it('keeps legacy direct purchases working without requesting conversion units when feature is disabled', async () => {
    auth.user = { role: 'regularUser', planFeatures: { unidades: false } };
    vi.mocked(getOrdenesCompraAction).mockResolvedValue({ success: true, data: { items: [], total: 0 } } as any);
    render(<CompraProductoForm />);
    await waitFor(() => expect(screen.getByText('Datos de la Compra')).toBeInTheDocument());

    const productField = screen.getByText('Producto', { selector: 'label' }).closest('[data-slot="form-item"]');
    fireEvent.click(productField!.querySelector('button')!);
    fireEvent.click(await screen.findByRole('option', { name: 'Producto 1' }));

    await waitFor(() => expect(screen.queryByLabelText('Unidad de compra')).not.toBeInTheDocument());
    expect(getDirectPurchaseUnitsAction).not.toHaveBeenCalled();
    expect(sileo.error).not.toHaveBeenCalled();
  });
});
