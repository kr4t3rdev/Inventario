import React from 'react';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReplace = vi.fn();
const useAuthMock = vi.fn();
const mockFetch = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/busy/contabilidad/balance-resultados',
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => useAuthMock(),
}));

Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
  writable: true,
});

import BalanceResultadosPage from './page';

const balancePayload = {
  balance: {
    activos: { efectivo: 0, inventario: 0, cuentasPorCobrar: 0, total: 0 },
    pasivos: { deudaExterna: 0, total: 0 },
    patrimonio: { capitalSocial: 0, utilidadEjercicio: 0, total: 0 },
  },
  estadoResultados: {
    mensual: [],
    anual: {
      ingresosVentas: 0,
      ingresosServicios: 0,
      totalIngresos: 0,
      gastosCompras: 0,
      gastosSalarios: 0,
      gastosGenerales: 0,
      gastosMermas: 0,
      totalGastos: 0,
      utilidadNeta: 0,
    },
  },
  reporte: {
    origen: 'LIVE',
    provisional: true,
    fechaCorte: '2026-08-21T15:30:00.000Z',
    resultadoHasta: null,
    periodoId: null,
    integridad: null,
    snapshotVersion: null,
  },
};

describe('/busy/contabilidad/balance-resultados page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, json: async () => balancePayload });
  });

  it('no redirige mientras la sesión todavía está cargando', async () => {
    useAuthMock.mockReturnValue({ user: null, loading: true });
    render(<BalanceResultadosPage />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('permite acceso al plan básico con contabilidad habilitada', async () => {
    useAuthMock.mockReturnValue({
      user: { role: 'user', planName: 'Básico', planFeatures: { contabilidad: true, 'reportes-financieros': false } },
      loading: false,
    });

    render(<BalanceResultadosPage />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
