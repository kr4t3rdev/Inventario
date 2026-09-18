import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReplace = vi.fn();
const useAuthMock = vi.fn();
const mockFetch = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/busy/contabilidad/facturas-vencidas',
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => useAuthMock(),
}));

Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
  writable: true,
});

import FacturasVencidasPage from './page';

describe('/busy/contabilidad/facturas-vencidas page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ facturas: [] }),
    });
  });

  it('redirige al dashboard de contabilidad cuando el plan es Básico', async () => {
    useAuthMock.mockReturnValue({
      user: {
        role: 'user',
        planName: 'Básico',
        planFeatures: { contabilidad: true, 'reportes-financieros': true, 'facturas-vencidas': false },
      },
    });

    render(<FacturasVencidasPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/busy/contabilidad');
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
