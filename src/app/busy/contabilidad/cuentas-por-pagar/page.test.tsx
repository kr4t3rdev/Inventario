import React from 'react';
import { render, waitFor } from '@testing-library/react';
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

import CuentasPorPagarPage from './page';

describe('/busy/contabilidad/cuentas-por-pagar page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirige al dashboard de contabilidad cuando el plan no incluye cuentas por pagar', async () => {
    useAuthMock.mockReturnValue({
      user: {
        role: 'user',
        planName: 'Básico',
        planFeatures: { contabilidad: true, 'cuentas-pagar': false },
      },
    });

    render(<CuentasPorPagarPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/busy/contabilidad');
    });
  });
});
