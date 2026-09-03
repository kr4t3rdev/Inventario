import React from 'react';
import { render, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReplace = vi.fn();
const useAuthMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/busy/contabilidad/cuentas-por-cobrar',
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/features/contabilidad', () => ({
  getCuentasPorCobrarAction: vi.fn().mockResolvedValue({ success: true, data: { cuentas: [], pagination: { totalPages: 1 } } }),
  getCxcMetricsAction: vi.fn().mockResolvedValue({ success: true, data: {} }),
}));

vi.mock('@/features/ventas', () => ({
  getVentaByIdAction: vi.fn().mockResolvedValue({ success: true, data: null }),
}));

vi.mock('@/lib/token', () => ({
  getAuthToken: () => null,
}));

vi.mock('@/components/ui/animated-number', () => ({
  AnimatedNumber: ({ value, prefix }: { value: number; prefix?: string }) =>
    <span>{prefix}{value}</span>,
}));

vi.mock('@/features/contabilidad/components/cuentas-por-cobrar-table', () => ({
  CuentasPorCobrarTable: ({ onPageChange }: { onPageChange: (p: number) => void }) => (
    <button data-testid="ir-pagina-2" onClick={() => onPageChange(2)}>Página 2</button>
  ),
}));

Object.defineProperty(globalThis, 'fetch', {
  value: vi.fn(),
  writable: true,
});

import CuentasPorCobrarPage from './page';

describe('/busy/contabilidad/cuentas-por-cobrar page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carga métricas una sola vez y solo la tabla al cambiar de página', async () => {
    const { getCuentasPorCobrarAction, getCxcMetricsAction } = await import('@/features/contabilidad');
    useAuthMock.mockReturnValue({
      user: {
        role: 'user',
        planName: 'Profesional',
        planFeatures: { contabilidad: true, 'cuentas-cobrar': true },
      },
    });

    render(<CuentasPorCobrarPage />);

    await waitFor(() => {
      expect(vi.mocked(getCxcMetricsAction)).toHaveBeenCalledTimes(1);
    });

    // Cambiar de página desde la tabla: métricas NO deben recargarse, lista sí.
    const { getByTestId } = screen;
    await waitFor(() => expect(getByTestId('ir-pagina-2')).toBeInTheDocument());
    await userEvent.click(getByTestId('ir-pagina-2'));

    await waitFor(() => {
      expect(vi.mocked(getCuentasPorCobrarAction).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(vi.mocked(getCxcMetricsAction)).toHaveBeenCalledTimes(1);
  });

  it('redirige al dashboard de contabilidad cuando el plan no incluye cuentas por cobrar', async () => {
    useAuthMock.mockReturnValue({
      user: {
        role: 'user',
        planName: 'Básico',
        planFeatures: { contabilidad: true, 'cuentas-cobrar': false },
      },
    });

    render(<CuentasPorCobrarPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/busy/contabilidad');
    });
  });
});
