import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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

vi.mock('@/features/contabilidad/components/accounting-page-shell', () => ({
  AccountingPageShell: ({ title, description, actions, children }: React.PropsWithChildren<{
    title: string;
    description: string;
    actions?: React.ReactNode;
  }>) => (
    <main data-testid="accounting-page-shell">
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
      {children}
    </main>
  ),
}));

import DeudasCashPage from './page';
import { getDeudasCashAction } from '@/features/contabilidad/actions-deudas-cash';

describe('/busy/contabilidad/deudas-cash page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('permite consultar deudas cash existentes cuando el plan no permite crearlas', async () => {
    useAuthMock.mockReturnValue({
      user: {
        role: 'user',
        planName: 'Básico',
        planFeatures: { contabilidad: true, 'deudas-cash': false },
      },
    });

    render(<DeudasCashPage />);

    await waitFor(() => expect(getDeudasCashAction).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Nueva Deuda/i })).not.toBeInTheDocument();
  });

  it('usa el shell contable y conserva la acción para crear deudas', async () => {
    useAuthMock.mockReturnValue({ user: { role: 'admin' } });

    render(<DeudasCashPage />);

    expect(await screen.findByTestId('accounting-page-shell')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Deudas en Efectivo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva Deuda' })).toBeInTheDocument();
  });
});
