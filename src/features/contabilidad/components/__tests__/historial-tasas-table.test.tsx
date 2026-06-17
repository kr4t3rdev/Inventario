import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { HistorialTasasTable } from '../historial-tasas-table';

const mockGetMonedasAction = vi.fn();
const mockGetHistorialTasasAction = vi.fn();

vi.mock('@/features/contabilidad/actions-exchange', () => ({
  getMonedasAction: (...args: unknown[]) => mockGetMonedasAction(...args),
  getHistorialTasasAction: (...args: unknown[]) => mockGetHistorialTasasAction(...args),
}));

describe('HistorialTasasTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMonedasAction.mockResolvedValue({
      success: true,
      data: [
        { codigo: 'CUP', nombre: 'Peso Cubano', simbolo: '$', esPrincipal: true, isActive: true },
        { codigo: 'USD', nombre: 'Dólar', simbolo: '$', esPrincipal: false, isActive: true },
      ],
    });
    mockGetHistorialTasasAction.mockResolvedValue({
      success: true,
      data: {
        tasas: [
          {
            tasaId: 'rate-2',
            monedaOrigenId: 'USD',
            monedaDestino: 'CUP',
            tasa: 24.75,
            fechaVigencia: '2026-06-15T10:00:00.000Z',
            creadoPor: 'Sofia',
            provenance: 'Importación manual',
          },
          {
            tasaId: 'rate-1',
            monedaOrigenId: 'USD',
            monedaDestino: 'CUP',
            tasa: 24.5,
            fechaVigencia: '2026-06-14T10:00:00.000Z',
            creadoPor: 'Sistema',
            provenance: 'Sistema',
          },
        ],
        total: 2,
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      },
    });
  });

  it('renders audit and provenance columns for the exchange history', async () => {
    render(<HistorialTasasTable />);

    await waitFor(() => {
      expect(screen.getByText('Historial de Tasas de Cambio')).toBeInTheDocument();
    });

    expect(screen.getByText('Tasa ID')).toBeInTheDocument();
    expect(screen.getByText('Proveniencia')).toBeInTheDocument();
    expect(screen.getByText('Registrado por')).toBeInTheDocument();
    expect(screen.getByText('rate-2')).toBeInTheDocument();
    expect(screen.getByText('Importación manual')).toBeInTheDocument();
    expect(screen.getByText('Sofia')).toBeInTheDocument();
  });

  it('shows a dedicated empty state when there is no history', async () => {
    mockGetHistorialTasasAction.mockResolvedValueOnce({
      success: true,
      data: {
        tasas: [],
        total: 0,
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      },
    });

    render(<HistorialTasasTable />);

    await waitFor(() => {
      expect(screen.getByText('No hay historial de tasas disponible')).toBeInTheDocument();
    });
  });

  it('loads the next page through the deterministic pagination contract', async () => {
    const user = userEvent.setup();
    mockGetHistorialTasasAction
      .mockResolvedValueOnce({
        success: true,
        data: {
          tasas: [
            {
              tasaId: 'rate-2',
              monedaOrigenId: 'USD',
              monedaDestino: 'CUP',
              tasa: 24.75,
              fechaVigencia: '2026-06-15T10:00:00.000Z',
              creadoPor: 'Sofia',
              provenance: 'Importación manual',
            },
          ],
          total: 25,
          pagination: { page: 1, limit: 20, total: 25, totalPages: 2 },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          tasas: [],
          total: 25,
          pagination: { page: 2, limit: 20, total: 25, totalPages: 2 },
        },
      });

    render(<HistorialTasasTable />);

    await waitFor(() => {
      expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => {
      expect(mockGetHistorialTasasAction).toHaveBeenLastCalledWith(
        expect.objectContaining({ pagina: 2, limite: 20 }),
      );
    });
  });
});
