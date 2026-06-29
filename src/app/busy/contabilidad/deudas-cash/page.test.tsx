import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReplace = vi.fn();
const useAuthMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/busy/contabilidad/deudas-cash',
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/features/contabilidad/actions-cuentas-bancarias', () => ({
  getCuentasBancariasAction: vi.fn().mockResolvedValue({ success: true, data: { cuentas: [] } }),
}));

vi.mock('@/features/contabilidad/actions-tipos-pago', () => ({
  getTiposPagoAction: vi.fn().mockResolvedValue({ success: true, data: { data: [] } }),
}));

vi.mock('@/features/contabilidad/actions-deudas-cash', () => ({
  getDeudasCashAction: vi.fn().mockResolvedValue({ success: true, data: { deudas: [] } }),
}));

vi.mock('@/features/vendors/hooks/use-vendors', () => ({
  useVendors: () => ({ vendors: [] }),
}));

vi.mock('@/features/contabilidad/components/deudas-cash/deudas-cash-table', () => ({
  DeudasCashTable: () => null,
}));

vi.mock('@/features/contabilidad/components/deudas-cash/deuda-cash-form', () => ({
  DeudaCashForm: () => null,
}));

vi.mock('@/features/contabilidad/components/deudas-cash/pago-deuda-modal', () => ({
  PagoDeudaModal: () => null,
}));

import DeudasCashPage from './page';

describe('/busy/contabilidad/deudas-cash page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirige al dashboard de contabilidad cuando el plan no incluye deudas cash', async () => {
    useAuthMock.mockReturnValue({
      user: {
        role: 'user',
        planName: 'Básico',
        planFeatures: { contabilidad: true, 'deudas-cash': false },
      },
    });

    render(<DeudasCashPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/busy/contabilidad');
    });
  });
});
