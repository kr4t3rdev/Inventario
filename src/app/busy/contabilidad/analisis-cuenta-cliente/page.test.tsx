import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReplace = vi.fn();
const useAuthMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/busy/contabilidad/analisis-cuenta-cliente',
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/features/clientes/hooks/use-clientes', () => ({
  useClientes: () => ({ clientes: [], isLoading: false }),
}));

vi.mock('@/features/contabilidad', () => ({
  getCuentasPorCobrarAction: vi.fn().mockResolvedValue({ success: true, data: { cuentas: [] } }),
}));

vi.mock('@/features/facturas/actions', () => ({
  getFacturasAction: vi.fn().mockResolvedValue({ success: true, data: { data: [] } }),
}));

import AnalisisCuentaClientePage from './page';

describe('/busy/contabilidad/analisis-cuenta-cliente page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirige al dashboard de contabilidad cuando el plan es Básico', async () => {
    useAuthMock.mockReturnValue({
      user: {
        role: 'user',
        planName: 'Básico',
        planFeatures: { contabilidad: true, 'reportes-financieros': true },
      },
    });

    render(<AnalisisCuentaClientePage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/busy/contabilidad');
    });
  });
});
