import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/features/compras-productos/actions-oc', () => ({
  createOrdenCompraAction: vi.fn(),
  confirmarOrdenCompraAction: vi.fn(),
  registrarRecepcionAction: vi.fn(),
  cancelarOrdenCompraAction: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import {
  cancelarOrdenCompraAction,
  confirmarOrdenCompraAction,
  createOrdenCompraAction,
  registrarRecepcionAction,
} from '@/features/compras-productos/actions-oc';
import { OrdenesCompraPageClient } from '@/features/compras-productos/components/ordenes-compra-page-client';

const props = {
  vendors: [{ vendorId: 'ven-1', nombre: 'Proveedor 1' }],
  products: [{ id: 'prod-1', nombre: 'Producto 1' }],
  orders: [],
};

describe('OrdenesCompraPageClient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('crea una orden con la línea capturada', async () => {
    vi.mocked(createOrdenCompraAction).mockResolvedValue({ success: true, data: {} } as any);
    render(<OrdenesCompraPageClient {...props} />);
    fireEvent.change(screen.getByLabelText(/proveedor/i), { target: { value: 'ven-1' } });
    fireEvent.change(screen.getByLabelText(/producto/i), { target: { value: 'prod-1' } });
    fireEvent.change(screen.getByLabelText(/cantidad/i), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/precio unitario/i), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: /crear orden/i }));

    await waitFor(() => expect(createOrdenCompraAction).toHaveBeenCalledWith({
      proveedorId: 'ven-1',
      items: [{ productoId: 'prod-1', cantidadPedida: 5, precioUnitario: 20 }],
    }));
  });

  it('confirma, recibe y cancela acciones sobre órdenes existentes', async () => {
    vi.mocked(confirmarOrdenCompraAction).mockResolvedValue({ success: true, data: {} } as any);
    vi.mocked(registrarRecepcionAction).mockResolvedValue({ success: true, data: {} } as any);
    vi.mocked(cancelarOrdenCompraAction).mockResolvedValue({ success: true, data: {} } as any);
    render(<OrdenesCompraPageClient {...props} orders={[{
      id: 'oc-1', estado: 'CONFIRMADA', proveedor: { nombre: 'Proveedor 1' },
      items: [{ id: 'item-1', producto: { nombre: 'Producto 1' }, cantidadPedida: 10, cantidadRecibida: 0 }],
      createdAt: new Date().toISOString(), total: 200,
    }]} />);

    fireEvent.click(screen.getByRole('button', { name: /recibir/i }));
    fireEvent.change(screen.getByLabelText(/cantidad a recibir/i), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar recepción/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    await waitFor(() => {
      expect(registrarRecepcionAction).toHaveBeenCalledWith({
        ordenId: 'oc-1', items: [{ ordenItemId: 'item-1', cantidad: 6 }],
      });
      expect(cancelarOrdenCompraAction).toHaveBeenCalledWith('oc-1');
    });
  });
});
