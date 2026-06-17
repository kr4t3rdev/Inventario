import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ConversionDialog } from '../conversion-dialog';

const mockGetMonedasAction = vi.fn();
const mockConvertMoneyAction = vi.fn();

vi.mock('@/features/contabilidad/actions-exchange', () => ({
  getMonedasAction: (...args: unknown[]) => mockGetMonedasAction(...args),
  convertMoneyAction: (...args: unknown[]) => mockConvertMoneyAction(...args),
}));

vi.mock('@/lib/sileo-shim', () => ({
  sileo: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ConversionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMonedasAction.mockResolvedValue({
      success: true,
      data: [
        { codigo: 'CUP', nombre: 'Peso Cubano', simbolo: '$', esPrincipal: true, isActive: true },
        { codigo: 'USD', nombre: 'Dólar', simbolo: '$', esPrincipal: false, isActive: true },
        { codigo: 'EUR', nombre: 'Euro', simbolo: '€', esPrincipal: false, isActive: false },
      ],
    });
  });

  it('renders quote provenance after conversion and swaps the pair', async () => {
    const user = userEvent.setup();
    mockConvertMoneyAction.mockResolvedValue({
      success: true,
      data: {
        montoOriginal: 10,
        montoConvertido: 245,
        tasaUsada: 24.5,
        tasaAplicada: 24.5,
        monedaOrigen: 'USD',
        monedaDestino: 'CUP',
        ruta: 'direct',
        tasaId: 'rate-1',
        effectiveAt: '2026-06-14T10:00:00.000Z',
        proveedor: 'prisma',
        referenciaId: 'exchange-1',
      },
    });

    render(<ConversionDialog onClose={vi.fn()} />);

    await waitFor(() => {
      expect(mockGetMonedasAction).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getAllByRole('combobox')[0]);
    await user.click(screen.getByText('USD'));
    await user.click(screen.getAllByRole('combobox')[1]);
    await user.click(screen.getByText('CUP'));

    await user.click(screen.getByRole('button', { name: /intercambiar monedas/i }));

    await user.type(screen.getByLabelText('Monto a Convertir'), '10');
    await user.click(screen.getByRole('button', { name: 'Convertir' }));

    await waitFor(() => {
      expect(mockConvertMoneyAction).toHaveBeenCalledWith(
        expect.objectContaining({
          monedaOrigen: 'CUP',
          monedaDestino: 'USD',
          monto: 10,
        }),
      );
    });

    expect(screen.getByText(/tasa id rate-1/i)).toBeInTheDocument();
    expect(screen.getByText(/Ruta/i)).toBeInTheDocument();
    expect(screen.getByText(/direct/i)).toBeInTheDocument();
  });

  it('shows inactive currencies and inline failure messaging', async () => {
    const user = userEvent.setup();
    mockConvertMoneyAction.mockResolvedValue({
      success: false,
      error: { message: 'No hay tasa vigente para este par' },
    });

    render(<ConversionDialog onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('EUR')).toBeInTheDocument();
      expect(screen.getByText('Inactiva')).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole('combobox')[0]);
    await user.click(screen.getByText('USD'));
    await user.click(screen.getAllByRole('combobox')[1]);
    await user.click(screen.getByText('CUP'));
    await user.type(screen.getByLabelText('Monto a Convertir'), '10');
    await user.click(screen.getByRole('button', { name: 'Convertir' }));

    await waitFor(() => {
      expect(screen.getByText('No hay tasa vigente para este par')).toBeInTheDocument();
    });
  });

  it('keeps the submit button disabled until the quote inputs are ready', async () => {
    render(<ConversionDialog onClose={vi.fn()} />);

    await waitFor(() => {
      expect(mockGetMonedasAction).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('button', { name: 'Convertir' })).toBeDisabled();
  });
});
