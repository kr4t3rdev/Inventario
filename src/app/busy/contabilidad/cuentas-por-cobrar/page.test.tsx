import React from 'react';
import { render, waitFor } from '@testing-library/react';
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

Object.defineProperty(globalThis, 'fetch', {
  value: vi.fn(),
  writable: true,
});

import CuentasPorCobrarPage from './page';

describe('/busy/contabilidad/cuentas-por-cobrar page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
