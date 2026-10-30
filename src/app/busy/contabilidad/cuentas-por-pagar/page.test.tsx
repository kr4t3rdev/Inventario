import React from 'react';
import { render, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReplace = vi.fn();
const useAuthMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/busy/contabilidad/cuentas-por-pagar',
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/features/contabilidad', () => ({
  getCuentasPorPagarAction: vi.fn().mockResolvedValue({ success: true, data: { cuentas: [], pagination: { totalPages: 1 } } }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/components/ui/animated-number', () => ({
  AnimatedNumber: ({ value }: { value: number }) => <span>{value}</span>,
}));

import CuentasPorPagarPage from './page';

describe('/busy/contabilidad/cuentas-por-pagar page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carga la consulta de CxP cuando el plan no permite crear cuentas por pagar', async () => {
    const { getCuentasPorPagarAction } = await import('@/features/contabilidad');
    useAuthMock.mockReturnValue({
      user: {
        role: 'regularUser',
        planName: 'Básico',
        planFeatures: { contabilidad: true, 'cuentas-pagar': false },
      },
    });

    render(<CuentasPorPagarPage />);

    await waitFor(() => {
      expect(vi.mocked(getCuentasPorPagarAction)).toHaveBeenCalledTimes(1);
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('debounce: teclear 3 letras de búsqueda dispara solo una consulta extra', async () => {
    const { getCuentasPorPagarAction } = await import('@/features/contabilidad');
    useAuthMock.mockReturnValue({
      user: {
        role: 'regularUser',
        planName: 'Profesional',
        planFeatures: { contabilidad: true, 'cuentas-pagar': true },
      },
    });

    render(<CuentasPorPagarPage />);
    await waitFor(() => expect(vi.mocked(getCuentasPorPagarAction)).toHaveBeenCalledTimes(1));

    const input = screen.getByPlaceholderText(/buscar por factura o proveedor/i);
    await userEvent.type(input, 'abc');

    // Sin debounce serían 1 inicial + 3 tecleos = 4; con debounce: 1 inicial + 1 final = 2.
    await waitFor(
      () => expect(vi.mocked(getCuentasPorPagarAction).mock.calls.length).toBeLessThanOrEqual(2),
      { timeout: 1200 },
    );
    await new Promise((r) => setTimeout(r, 600));
    expect(vi.mocked(getCuentasPorPagarAction)).toHaveBeenCalledTimes(2);
  });

  it('el error de carga ofrece reintento inline que vuelve a consultar', async () => {
    const { getCuentasPorPagarAction } = await import('@/features/contabilidad');
    useAuthMock.mockReturnValue({
      user: {
        role: 'regularUser',
        planName: 'Profesional',
        planFeatures: { contabilidad: true, 'cuentas-pagar': true },
      },
    });

    vi.mocked(getCuentasPorPagarAction)
      .mockResolvedValueOnce({ success: false, error: { message: 'fallo' } })
      .mockResolvedValueOnce({ success: true, data: { cuentas: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
  metricas: { totalCuentas: 0, totalFacturado: 0, totalPagado: 0, totalSaldo: 0, cuentasPendientes: 0, cuentasPagadas: 0 } } });

    render(<CuentasPorPagarPage />);

    const retry = await screen.findByRole('button', { name: /intentar nuevamente/i });
    await userEvent.click(retry);

    await waitFor(() => {
      expect(vi.mocked(getCuentasPorPagarAction).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
