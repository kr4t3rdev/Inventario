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
    await waitFor(() => {
      expect(registrarRecepcionAction).toHaveBeenCalledWith({
        ordenId: 'oc-1',
        claveIdempotencia: expect.any(String),
        items: [{ ordenItemId: 'item-1', cantidad: 6 }],
      });
    });

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    await waitFor(() => {
      expect(cancelarOrdenCompraAction).toHaveBeenCalledWith('oc-1');
    });
  });

  it('crea una orden con varias líneas', async () => {
    vi.mocked(createOrdenCompraAction).mockResolvedValue({ success: true, data: {} } as any);
    render(<OrdenesCompraPageClient {...props} products={[
      { id: 'prod-1', nombre: 'Producto 1' },
      { id: 'prod-2', nombre: 'Producto 2' },
    ]} />);
    fireEvent.change(screen.getByLabelText(/proveedor/i), { target: { value: 'ven-1' } });
    fireEvent.change(screen.getByLabelText(/^producto 1$/i), { target: { value: 'prod-1' } });
    fireEvent.change(screen.getByLabelText(/^cantidad 1$/i), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/^precio unitario 1$/i), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: /agregar línea/i }));
    fireEvent.change(screen.getByLabelText(/^producto 2$/i), { target: { value: 'prod-2' } });
    fireEvent.change(screen.getByLabelText(/^cantidad 2$/i), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText(/^precio unitario 2$/i), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: /crear orden/i }));

    await waitFor(() => expect(createOrdenCompraAction).toHaveBeenCalledWith({
      proveedorId: 'ven-1',
      items: [
        { productoId: 'prod-1', cantidadPedida: 5, precioUnitario: 20 },
        { productoId: 'prod-2', cantidadPedida: 3, precioUnitario: 7 },
      ],
    }));
  });

  it('recibe una línea distinta de la primera y conserva el panel si falla', async () => {
    vi.mocked(registrarRecepcionAction).mockResolvedValue({
      success: false, error: { message: 'La recepción excede el pendiente' },
    } as any);
    render(<OrdenesCompraPageClient {...props} orders={[{
      id: 'oc-1', estado: 'PARCIAL', proveedor: { nombre: 'Proveedor 1' },
      items: [
        { id: 'item-1', producto: { nombre: 'Producto 1' }, cantidadPedida: 10, cantidadRecibida: 10 },
        { id: 'item-2', producto: { nombre: 'Producto 2' }, cantidadPedida: 5, cantidadRecibida: 1 },
      ],
      createdAt: new Date().toISOString(), total: 200,
    }]} />);

    fireEvent.click(screen.getByRole('button', { name: /recibir/i }));
    fireEvent.change(screen.getByLabelText(/línea de orden/i), { target: { value: 'item-2' } });
    fireEvent.change(screen.getByLabelText(/cantidad a recibir/i), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar recepción/i }));

    await waitFor(() => {
      expect(registrarRecepcionAction).toHaveBeenCalledWith(expect.objectContaining({
        items: [{ ordenItemId: 'item-2', cantidad: 9 }],
      }));
      expect(screen.getByRole('alert')).toHaveTextContent('La recepción excede el pendiente');
      expect(screen.getByLabelText(/cantidad a recibir/i)).toBeInTheDocument();
    });
  });

  it('reutiliza la misma clave al reintentar una recepción fallida', async () => {
    vi.mocked(registrarRecepcionAction).mockResolvedValue({
      success: false, error: { message: 'Respuesta ambigua' },
    } as any);
    render(<OrdenesCompraPageClient {...props} orders={[{
      id: 'oc-1', estado: 'CONFIRMADA', proveedor: { nombre: 'Proveedor 1' },
      items: [
        { id: 'item-1', producto: { nombre: 'Producto 1' }, cantidadPedida: 10, cantidadRecibida: 0 },
      ],
      createdAt: new Date().toISOString(), total: 200,
    }]} />);

    fireEvent.click(screen.getByRole('button', { name: /recibir/i }));
    fireEvent.change(screen.getByLabelText(/cantidad a recibir/i), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar recepción/i }));
    await waitFor(() => expect(registrarRecepcionAction).toHaveBeenCalledTimes(1));
    const firstKey = vi.mocked(registrarRecepcionAction).mock.calls[0][0].claveIdempotencia;

    fireEvent.click(screen.getByRole('button', { name: /guardar recepción/i }));
    await waitFor(() => expect(registrarRecepcionAction).toHaveBeenCalledTimes(2));
    expect(vi.mocked(registrarRecepcionAction).mock.calls[1][0].claveIdempotencia).toBe(firstKey);
  });

  it('oculta crear y cancelar sin permiso de órdenes y recibir sin permiso de recepciones', () => {
    render(<OrdenesCompraPageClient {...props} canManageOrders={false} canReceive={false} orders={[{
      id: 'oc-1', estado: 'CONFIRMADA', proveedor: { nombre: 'Proveedor 1' },
      items: [{ id: 'item-1', producto: { nombre: 'Producto 1' }, cantidadPedida: 10, cantidadRecibida: 0 }],
      createdAt: new Date().toISOString(), total: 200,
    }]} />);

    expect(screen.queryByRole('button', { name: /crear orden/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /recibir/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancelar/i })).not.toBeInTheDocument();
  });
});
