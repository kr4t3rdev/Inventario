import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReplace = vi.fn();
const useAuthMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/busy/contabilidad/prestamos-cash',
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/features/clientes', () => ({
  getClientesAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

vi.mock('@/features/contabilidad/actions-cuentas-bancarias', () => ({
  getCuentasBancariasAction: vi.fn().mockResolvedValue({ success: true, data: { cuentas: [] } }),
}));

vi.mock('@/features/contabilidad/actions-exchange', () => ({
  getTasasActualesAction: vi.fn().mockResolvedValue({ success: true, data: {} }),
}));

vi.mock('@/features/contabilidad/actions-tipos-pago', () => ({
  getTiposPagoAction: vi.fn().mockResolvedValue({ success: true, data: { data: [] } }),
}));

vi.mock('@/features/contabilidad/actions-prestamos-cash', () => ({
  getPrestamosCashAction: vi.fn().mockResolvedValue({ success: true, data: { prestamos: [] } }),
}));

import PrestamosCashPage from './page';
import { getPrestamosCashAction } from '@/features/contabilidad/actions-prestamos-cash';

describe('/busy/contabilidad/prestamos-cash page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('permite consultar préstamos existentes sin permitir crear en Básico', async () => {
    useAuthMock.mockReturnValue({
      user: {
        role: 'user',
        planName: 'Básico',
        planFeatures: { contabilidad: true, 'prestamos-cash': false },
      },
    });

    render(<PrestamosCashPage />);

    await waitFor(() => expect(getPrestamosCashAction).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Nuevo Préstamo/i })).not.toBeInTheDocument();
  });
});
