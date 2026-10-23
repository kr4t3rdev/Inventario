import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createVentaAction: vi.fn(),
  getPuntosDeVentaAction: vi.fn(),
  getClientesAction: vi.fn(),
  getProductosPorUbicacion: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/features/ventas/actions', () => ({ createVentaAction: mocks.createVentaAction }));
vi.mock('@/features/puntos-venta/actions', () => ({
  getPuntosDeVentaAction: mocks.getPuntosDeVentaAction,
}));
vi.mock('@/features/clientes/actions', () => ({ getClientesAction: mocks.getClientesAction }));
vi.mock('@/app/actions/productos-ubicacion', () => ({
  getProductosPorUbicacion: mocks.getProductosPorUbicacion,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { NuevoPedidoDialog } from './nuevo-pedido-dialog';

function ControlledDialog() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Abrir pedido</button>
      <NuevoPedidoDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

async function startOrder(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('combobox', { name: 'Punto de venta' }));
  await user.click(await screen.findByRole('option', { name: 'Tienda' }));
  await user.click(screen.getByRole('button', { name: 'Agregar' }));
  await user.click(screen.getAllByRole('combobox')[2]);
  await user.click(await screen.findByRole('option', { name: /Producto 1/ }));
}

describe('NuevoPedidoDialog sale-create intent lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPuntosDeVentaAction.mockResolvedValue({ success: true, data: [{ pvId: 'pv-1', nombre: 'Tienda' }] });
    mocks.getClientesAction.mockResolvedValue({ success: true, data: [] });
    mocks.getProductosPorUbicacion.mockResolvedValue([{
      id: 'prod-1', nombre: 'Producto 1', precioVentaResuelto: 20,
    }]);
    mocks.createVentaAction.mockResolvedValue({ success: true, data: { ventaId: 'sale-1' } });
  });

  it('retains the key and draft across failed submission and close/reopen retry', async () => {
    const user = userEvent.setup();
    mocks.createVentaAction.mockResolvedValueOnce({
      success: false, error: { message: 'Respuesta incierta' },
    });
    render(<ControlledDialog />);
    await startOrder(user);
    await user.click(screen.getByRole('button', { name: 'Crear pedido' }));
    await waitFor(() => expect(mocks.createVentaAction).toHaveBeenCalledTimes(1));
    const firstInput = mocks.createVentaAction.mock.calls[0][0];

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(screen.getByRole('button', { name: 'Abrir pedido' }));
    await user.click(screen.getByRole('button', { name: 'Crear pedido' }));

    await waitFor(() => expect(mocks.createVentaAction).toHaveBeenCalledTimes(2));
    expect(mocks.createVentaAction.mock.calls[1][0]).toEqual(firstInput);
    expect(mocks.createVentaAction.mock.calls[1][0].idempotencyKey).toBe(firstInput.idempotencyKey);
  });

  it('keeps the pending key for edited payload and lets the server report the mismatch', async () => {
    const user = userEvent.setup();
    mocks.createVentaAction
      .mockResolvedValueOnce({ success: false, error: { message: 'Respuesta incierta' } })
      .mockResolvedValueOnce({ success: false, error: { message: 'La clave ya se usó con otro contenido.' } });
    render(<ControlledDialog />);
    await startOrder(user);
    await user.click(screen.getByRole('button', { name: 'Crear pedido' }));
    await waitFor(() => expect(mocks.createVentaAction).toHaveBeenCalledTimes(1));
    const firstInput = mocks.createVentaAction.mock.calls[0][0];
    const discount = screen.getByLabelText('Descuento');
    fireEvent.change(discount, { target: { value: '5' } });
    await user.click(screen.getByRole('button', { name: 'Crear pedido' }));

    await waitFor(() => expect(mocks.createVentaAction).toHaveBeenCalledTimes(2));
    const editedInput = mocks.createVentaAction.mock.calls[1][0];
    expect(editedInput.idempotencyKey).toBe(firstInput.idempotencyKey);
    expect(editedInput.descuento).toBe(5);
  });

  it('rotates after success and explicit draft abandonment clears the form', async () => {
    const user = userEvent.setup();
    mocks.createVentaAction
      .mockResolvedValueOnce({ success: true, data: { ventaId: 'sale-1' } })
      .mockResolvedValueOnce({ success: false, error: { message: 'Respuesta incierta' } })
      .mockResolvedValueOnce({ success: true, data: { ventaId: 'sale-2' } });
    render(<ControlledDialog />);
    await startOrder(user);
    await user.click(screen.getByRole('button', { name: 'Crear pedido' }));
    await waitFor(() => expect(mocks.createVentaAction).toHaveBeenCalledTimes(1));
    const successfulKey = mocks.createVentaAction.mock.calls[0][0].idempotencyKey;

    await user.click(screen.getByRole('button', { name: 'Abrir pedido' }));
    await startOrder(user);
    await user.click(screen.getByRole('button', { name: 'Crear pedido' }));
    await waitFor(() => expect(mocks.createVentaAction).toHaveBeenCalledTimes(2));
    const uncertainKey = mocks.createVentaAction.mock.calls[1][0].idempotencyKey;
    expect(uncertainKey).not.toBe(successfulKey);

    await user.click(screen.getByRole('button', { name: 'Descartar borrador' }));
    await user.click(screen.getByRole('button', { name: 'Abrir pedido' }));
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled();
    expect(screen.queryByRole('spinbutton', { name: /Cantidad del producto/ })).not.toBeInTheDocument();
    await startOrder(user);
    await user.click(screen.getByRole('button', { name: 'Crear pedido' }));
    await waitFor(() => expect(mocks.createVentaAction).toHaveBeenCalledTimes(3));
    expect(mocks.createVentaAction.mock.calls[2][0].idempotencyKey).not.toBe(uncertainKey);
  });
});
