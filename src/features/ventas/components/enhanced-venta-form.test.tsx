import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getProductosAction: vi.fn(),
  createVentaAction: vi.fn(),
  updateVentaAction: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/features/productos/actions', () => ({ getProductosAction: mocks.getProductosAction }));
vi.mock('@/features/ventas/actions', () => ({
  createVentaAction: mocks.createVentaAction,
  updateVentaAction: mocks.updateVentaAction,
}));
vi.mock('@/features/puntos-venta/hooks/use-puntos-de-venta', () => ({
  usePuntosDeVenta: () => ({
    puntosDeVenta: [{ pvId: 'pv-1', nombre: 'Tienda' }],
    isLoading: false,
  }),
}));
vi.mock('@/features/contabilidad/hooks/use-monedas', () => ({
  useMonedas: () => ({ monedas: [
    { codigo: 'CUP', simbolo: '$', nombre: 'Peso', isActive: true, esPrincipal: true },
    { codigo: 'USD', simbolo: '$', nombre: 'Dólar', isActive: true, esPrincipal: false },
  ] }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock('@/features/contabilidad/components/tasa-cambio-dialog', () => ({
  TasaCambioDialog: ({ onClose, onConfirm }: {
    onClose: () => void;
    onConfirm: (rate: number, converted: number) => void;
  }) => (
    <div role="dialog" aria-label="Tasa de cambio">
      <button type="button" onClick={onClose}>Cancelar tasa</button>
      <button type="button" onClick={() => onConfirm(100, 2000)}>Confirmar tasa</button>
    </div>
  ),
}));

import { EnhancedVentaForm } from './enhanced-venta-form';

async function chooseOption(user: ReturnType<typeof userEvent.setup>, index: number, option: RegExp) {
  await user.click(screen.getAllByRole('combobox')[index]);
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('EnhancedVentaForm sale-create key lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProductosAction.mockResolvedValue({ success: true, data: [{
      id: 'prod-1', nombre: 'Producto 1', precioVenta: 20, stock: 10,
      unidad: { simbolo: 'ud' },
    }] });
    mocks.createVentaAction.mockResolvedValue({ success: true, data: { ventaId: 'sale-1' } });
  });

  it('does not send on first rate-dialog cancel and retains a failed sale key after retry cancel', async () => {
    const user = userEvent.setup();
    mocks.createVentaAction
      .mockResolvedValueOnce({ success: false, error: { message: 'Respuesta incierta' } })
      .mockResolvedValueOnce({ success: false, error: { message: 'Respuesta incierta' } });
    render(<EnhancedVentaForm />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Crear' })).toBeEnabled());
    await chooseOption(user, 0, /Producto 1/);
    await chooseOption(user, 1, /Tienda/);
    await chooseOption(user, 2, /USD/);

    await user.click(screen.getByRole('button', { name: 'Crear' }));
    await user.click(await screen.findByRole('button', { name: 'Cancelar tasa' }));
    expect(mocks.createVentaAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Crear' }));
    await user.click(await screen.findByRole('button', { name: 'Confirmar tasa' }));
    await waitFor(() => expect(mocks.createVentaAction).toHaveBeenCalledTimes(1));
    const firstKey = mocks.createVentaAction.mock.calls[0][0].idempotencyKey;

    await user.click(screen.getByRole('button', { name: 'Crear' }));
    await user.click(await screen.findByRole('button', { name: 'Cancelar tasa' }));
    expect(mocks.createVentaAction).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Crear' }));
    await user.click(await screen.findByRole('button', { name: 'Confirmar tasa' }));
    await waitFor(() => expect(mocks.createVentaAction).toHaveBeenCalledTimes(2));
    expect(mocks.createVentaAction.mock.calls[1][0].idempotencyKey).toBe(firstKey);
  });
});
