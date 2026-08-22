import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const populatedPayload = {
  balance: {
    activos: { efectivo: 1000, inventario: 200, cuentasPorCobrar: 50, total: 1250 },
    pasivos: { deudaExterna: 150, cuentasPorPagar: 100, total: 250 },
    patrimonio: { capitalSocial: 800, resultadosAcumulados: 50, resultadoPeriodo: 150, utilidadEjercicio: 150, total: 1000 },
    ecuacion: { assets: 1250, liabilitiesAndEquity: 1250, difference: 0, status: 'CUADRADO' },
    cobertura: { complete: false, unresolvedCount: 1, unresolvedAmount: 50, parts: [{}] },
    incidencias: [],
    monedaFuncional: 'CUP',
  },
  estadoResultados: {
    mensual: [],
    anual: {
      totalIngresos: 500,
      gastosCompras: 0,
      gastosSalarios: 100,
      gastosGenerales: 50,
      gastosMermas: 0,
      totalGastos: 250,
      utilidadNeta: 150,
    },
    incidencias: [],
  },
  reporte: {
    origen: 'LIVE',
    provisional: true,
    fechaCorte: '2026-08-21T15:30:00.000Z',
    resultadoHasta: null,
    periodoId: 'period-2026',
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

  it('presenta un estado vacío cuando el reporte solo contiene ceros', async () => {
    useAuthMock.mockReturnValue({
      user: { role: 'admin', planFeatures: { contabilidad: true } },
      loading: false,
    });

    render(<BalanceResultadosPage />);

    await waitFor(() => expect(screen.getByText('Sin actividad registrada')).toBeInTheDocument());

    expect(screen.getByRole('heading', { name: 'Balance general y resultados' })).toBeInTheDocument();
    expect(screen.queryByText('Total de activos')).not.toBeInTheDocument();
  });

  it('expone la ecuación y la revisión de pendientes cuando la cobertura es parcial', async () => {
    useAuthMock.mockReturnValue({
      user: { role: 'admin', planFeatures: { contabilidad: true } },
      loading: false,
    });
    mockFetch.mockImplementation(async (url: string) => url.includes('/periodos')
      ? { ok: true, json: async () => ({ periodos: [] }) }
      : { ok: true, json: async () => populatedPayload });

    render(<BalanceResultadosPage />);

    await waitFor(() => expect(screen.getByText('Activos = Pasivos + Patrimonio')).toBeInTheDocument());

    expect(screen.getByRole('link', { name: /Revisar pendientes/i })).toHaveAttribute('href', '/busy/contabilidad/reconciliacion');
    expect(screen.getByText('Cobertura parcial')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /Resultados/i }));
    await waitFor(() => expect(screen.getByText('Período de resultados')).toBeInTheDocument());
  });

  it('muestra un error accionable para un período sin evidencia', async () => {
    useAuthMock.mockReturnValue({
      user: { role: 'admin', planFeatures: { contabilidad: true } },
      loading: false,
    });
    mockFetch.mockImplementation(async (url: string) => url.includes('/periodos')
      ? { ok: true, json: async () => ({ periodos: [] }) }
      : { ok: false, status: 409, json: async () => ({ error: 'No existe evidencia histórica suficiente.' }) });

    render(<BalanceResultadosPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    expect(screen.getByText('No existe evidencia histórica suficiente.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar consulta/i })).toBeInTheDocument();
  });

  it('redirige a contabilidad cuando el plan no incluye la funcionalidad', async () => {
    useAuthMock.mockReturnValue({
      user: { role: 'user', planFeatures: { contabilidad: false } },
      loading: false,
    });

    render(<BalanceResultadosPage />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/busy/contabilidad'));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
