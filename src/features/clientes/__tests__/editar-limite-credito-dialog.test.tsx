/**
 * @description Tests del dialog de edición del límite de crédito (C-1):
 * valor actual precargado, guardado con la action dedicada, null = sin tope
 * y bloqueo local de valores inválidos.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/features/clientes/actions', () => ({
  updateLimiteCreditoClienteAction: vi.fn(),
}));

import { updateLimiteCreditoClienteAction } from '@/features/clientes/actions';
import { EditarLimiteCreditoDialog } from '@/features/clientes/components/editar-limite-credito-dialog';

const base = {
  open: true,
  onOpenChange: vi.fn(),
  clienteId: 'cli-1',
  limiteActual: 5000 as number | null,
  onActualizado: vi.fn(),
};

describe('EditarLimiteCreditoDialog (C-1)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('precarga el límite actual', () => {
    render(<EditarLimiteCreditoDialog {...base} />);
    const input = screen.getByLabelText('Límite de crédito');
    expect(input).toHaveValue(5000);
  });

  it('guarda el nuevo límite con la action dedicada', async () => {
    vi.mocked(updateLimiteCreditoClienteAction).mockResolvedValue({
      success: true,
      data: { clienteId: 'cli-1', limiteCredito: 8000 },
    } as never);

    render(<EditarLimiteCreditoDialog {...base} />);
    const input = screen.getByLabelText('Límite de crédito');
    fireEvent.change(input, { target: { value: '8000' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(updateLimiteCreditoClienteAction).toHaveBeenCalledWith({
      clienteId: 'cli-1',
      limiteCredito: 8000,
    });
    await vi.waitFor(() => {
      expect(base.onActualizado).toHaveBeenCalledWith(8000);
      expect(base.onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('campo vacío guarda null (sin tope)', async () => {
    vi.mocked(updateLimiteCreditoClienteAction).mockResolvedValue({
      success: true,
      data: { clienteId: 'cli-1', limiteCredito: null },
    } as never);

    render(<EditarLimiteCreditoDialog {...base} />);
    const input = screen.getByLabelText('Límite de crédito');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(updateLimiteCreditoClienteAction).toHaveBeenCalledWith({
      clienteId: 'cli-1',
      limiteCredito: null,
    });
    await vi.waitFor(() => {
      expect(base.onActualizado).toHaveBeenCalledWith(null);
    });
  });

  it('bloquea valores negativos o no enteros sin llamar la action', () => {
    render(<EditarLimiteCreditoDialog {...base} />);
    const input = screen.getByLabelText('Límite de crédito');

    fireEvent.change(input, { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    expect(updateLimiteCreditoClienteAction).not.toHaveBeenCalled();
    expect(screen.getByText(/entero mayor o igual a 0/i)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '10.5' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    expect(updateLimiteCreditoClienteAction).not.toHaveBeenCalled();
  });

  it('si la action falla no aplica el cambio ni cierra', async () => {
    vi.mocked(updateLimiteCreditoClienteAction).mockResolvedValue({
      success: false,
      error: { message: 'No tienes permisos para editar el límite de crédito del cliente.', code: 'FORBIDDEN' },
    } as never);

    render(<EditarLimiteCreditoDialog {...base} />);
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await vi.waitFor(() => {
      expect(base.onActualizado).not.toHaveBeenCalled();
      expect(base.onOpenChange).not.toHaveBeenCalledWith(false);
    });
  });

  it('muestra el placeholder de sin tope cuando el límite es null', () => {
    render(<EditarLimiteCreditoDialog {...base} limiteActual={null} />);
    const input = screen.getByLabelText('Límite de crédito');
    expect(input).toHaveValue(null);
  });
});
