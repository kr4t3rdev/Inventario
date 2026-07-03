import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReplace = vi.fn();
const useAuthMock = vi.fn();
const mockFetch = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/busy/contabilidad/balance-resultados',
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('framer-motion', () => ({
  useReducedMotion: () => true,
}));

vi.mock('@/components/ui/animations', () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StaggerContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StaggerItem: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AnimatedCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
  writable: true,
});

import BalanceResultadosPage from './page';

describe('/busy/contabilidad/balance-resultados page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
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
      }),
    });
  });

  it('mantiene acceso cuando reportes-financieros está habilitado', async () => {
    useAuthMock.mockReturnValue({
      user: {
        role: 'user',
        planName: 'Básico',
        planFeatures: { contabilidad: true, 'reportes-financieros': true },
      },
    });

    render(<BalanceResultadosPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
