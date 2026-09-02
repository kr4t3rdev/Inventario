import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDeudasCashStatsAction: vi.fn(),
}));

vi.mock('@/features/contabilidad/actions-deudas-cash', () => ({
  getDeudasCashStatsAction: mocks.getDeudasCashStatsAction,
}));

import { DeudasCashStatsWidget } from '../deudas-cash-stats-widget';

const statsBase = {
  totalActivas: 3,
  totalVencidas: 1,
  totalPagadas: 8,
  montoPendientePago: { CUP: 1200.5 },
};

describe('DeudasCashStatsWidget', () => {
  beforeEach(() => {
    mocks.getDeudasCashStatsAction.mockReset();
    mocks.getDeudasCashStatsAction.mockResolvedValue({ success: true, data: statsBase });
  });

  it('muestra skeleton accesible mientras carga', () => {
    mocks.getDeudasCashStatsAction.mockReturnValue(new Promise(() => {}));
    render(<DeudasCashStatsWidget />);

    expect(screen.getByLabelText('Cargando')).toHaveAttribute('aria-busy', 'true');
  });

  it('muestra contadores por estado y monto pendiente por pagar', async () => {
    render(<DeudasCashStatsWidget />);

    // Espera al estado listo (el skeleton comparte el título y se desmonta)
    expect(await screen.findByText('Pendiente por pagar')).toBeInTheDocument();
    expect(screen.getByText('Deudas en Efectivo')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/1.?200,50/)).toBeInTheDocument();
  });

  it('error muestra PanelError con reintento', async () => {
    mocks.getDeudasCashStatsAction.mockResolvedValue({ success: false, error: { message: 'fallo' } });
    render(<DeudasCashStatsWidget />);

    await screen.findByRole('alert');
    expect(screen.getByText(/no se pudieron cargar las estadísticas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /intentar nuevamente/i })).toBeInTheDocument();
  });

  it('el reintento recupera el widget tras un error', async () => {
    mocks.getDeudasCashStatsAction
      .mockResolvedValueOnce({ success: false, error: { message: 'fallo' } })
      .mockResolvedValueOnce({ success: true, data: statsBase });
    render(<DeudasCashStatsWidget />);

    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: /intentar nuevamente/i }));

    expect(await screen.findByText('Pendiente por pagar')).toBeInTheDocument();
    expect(mocks.getDeudasCashStatsAction).toHaveBeenCalledTimes(2);
  });
});
