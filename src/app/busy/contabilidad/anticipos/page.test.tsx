import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReplace = vi.fn();
const useAuthMock = vi.fn();
const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });

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

vi.mock('@/features/contabilidad/actions-tipos-pago', () => ({
  getTiposPagoAction: vi.fn().mockResolvedValue({ success: true, data: { data: [] } }),
}));

vi.mock('@/features/clientes', () => ({
  getClientesAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

vi.mock('@/features/vendors/hooks/use-vendors', () => ({
  useVendors: () => ({ vendors: [] }),
}));

vi.mock('@/features/contabilidad/components/anticipos/anticipos-table', () => ({
  AnticiposTable: () => null,
}));

vi.mock('@/features/contabilidad/components/anticipos/anticipo-form', () => ({
  AnticipoForm: () => null,
}));

vi.mock('@/features/contabilidad/components/anticipos/anticipo-detail', () => ({
  AnticipoDetail: () => null,
}));

vi.mock('@/features/contabilidad/components/anticipos/anticipo-financiar-dialog', () => ({
  AnticipoFinanciarDialog: () => null,
}));

vi.mock('@/features/contabilidad/components/anticipos/reportes-anticipos', () => ({
  ReportesAnticipos: () => null,
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

vi.mock('@/lib/token', () => ({
  getAuthToken: () => null,
}));

Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
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

  it('usa el shell contable y conserva la acción de crear anticipos', async () => {
    useAuthMock.mockReturnValue({ user: { role: 'admin' } });

    render(<AnticiposPage />);

    expect(await screen.findByTestId('accounting-page-shell')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Gestión de Anticipos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear Anticipo' })).toBeInTheDocument();
  });
});
