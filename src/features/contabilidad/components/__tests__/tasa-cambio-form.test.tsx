import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TasaCambioForm } from '../tasa-cambio-form';

const mockGetMonedasAction = vi.fn();
const mockGetTasasActualesAction = vi.fn();
const mockUpdateTasaCambioAction = vi.fn();

vi.mock('@/features/contabilidad/actions-exchange', () => ({
  getMonedasAction: (...args: unknown[]) => mockGetMonedasAction(...args),
  getTasasActualesAction: (...args: unknown[]) => mockGetTasasActualesAction(...args),
  updateTasaCambioAction: (...args: unknown[]) => mockUpdateTasaCambioAction(...args),
}));

vi.mock('@/lib/sileo-shim', () => ({
  sileo: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TasaCambioForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMonedasAction.mockResolvedValue({
      success: true,
      data: [
        { codigo: 'CUP', nombre: 'Peso Cubano', simbolo: '$', esPrincipal: true, isActive: true },
        { codigo: 'USD', nombre: 'Dólar', simbolo: '$', esPrincipal: false, isActive: true },
      ],
    });
    mockGetTasasActualesAction.mockResolvedValue({
      success: true,
      data: {
        monedaPrincipal: { codigo: 'CUP', nombre: 'Peso Cubano', simbolo: '$', esPrincipal: true, isActive: true },
        tasas: [
          {
            tasaId: 'rate-1',
            monedaOrigenId: 'USD',
            monedaDestino: 'CUP',
            tasa: 24.5,
            fechaVigencia: '2026-06-14T10:00:00.000Z',
            ruta: 'direct',
            effectiveAt: '2026-06-14T10:00:00.000Z',
            proveedor: 'prisma',
          },
        ],
      },
    });
  });

  it('shows the principal currency context and overwrite warning for an existing rate', async () => {
    const user = userEvent.setup();

    render(<TasaCambioForm onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Moneda principal activa')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('USD'));

    expect(screen.getByText(/Sobrescribirá la tasa vigente/i)).toBeInTheDocument();
    expect(screen.getByText(/tasa id rate-1/i)).toBeInTheDocument();
    expect(screen.getByText(/24.5/i)).toBeInTheDocument();
    expect(screen.getByText(/prisma/i)).toBeInTheDocument();
  });

  it('submits the selected rate against the principal currency', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    mockUpdateTasaCambioAction.mockResolvedValue({
      success: true,
      data: {
        tasaId: 'rate-2',
        monedaOrigenId: 'USD',
        monedaDestino: 'CUP',
        tasa: 24.75,
        fechaVigencia: '2026-06-16T10:00:00.000Z',
        createdAt: '2026-06-16T10:00:00.000Z',
      },
    });

    render(<TasaCambioForm onClose={vi.fn()} onSuccess={onSuccess} />);

    await waitFor(() => {
      expect(screen.getByText('Actualizar Tasa de Cambio')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('USD'));
    await user.type(screen.getByLabelText('Tasa de Cambio'), '24.75');
    await user.click(screen.getByRole('button', { name: /actualizar tasa/i }));

    await waitFor(() => {
      expect(mockUpdateTasaCambioAction).toHaveBeenCalledWith({
        monedaOrigenId: 'USD',
        monedaDestino: 'CUP',
        tasa: 24.75,
      });
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
