import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReplace = vi.fn();
const useAuthMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/busy/contabilidad/anticipos',
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/features/contabilidad/actions-anticipos', () => ({
  getAnticiposAction: vi.fn().mockResolvedValue({ success: true, data: { anticipos: [] } }),
  getAnticipoByIdAction: vi.fn().mockResolvedValue({ success: true, data: null }),
}));

vi.mock('@/features/contabilidad/actions-cuentas-bancarias', () => ({
  getCuentasBancariasAction: vi.fn().mockResolvedValue({ success: true, data: { cuentas: [] } }),
}));

vi.mock('@/features/clientes', () => ({
  getClientesAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

vi.mock('@/features/vendors/hooks/use-vendors', () => ({
  useVendors: () => ({ vendors: [] }),
}));

vi.mock('@/lib/token', () => ({
  getAuthToken: () => null,
}));

Object.defineProperty(globalThis, 'fetch', {
  value: vi.fn(),
  writable: true,
});

import AnticiposPage from './page';

describe('/busy/contabilidad/anticipos page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirige al dashboard de contabilidad cuando el plan no incluye anticipos', async () => {
    useAuthMock.mockReturnValue({
      user: {
        role: 'user',
        planName: 'Básico',
        planFeatures: { contabilidad: true, anticipos: false },
      },
    });

    render(<AnticiposPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/busy/contabilidad');
    });
  });
});
