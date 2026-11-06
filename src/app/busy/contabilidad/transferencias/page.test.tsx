import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReplace = vi.fn();
const useAuthMock = vi.fn();
const getTransferenciasBancariasActionMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/busy/contabilidad/transferencias',
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/features/contabilidad/actions', () => ({
  getTransferenciasBancariasAction: (...args: unknown[]) => getTransferenciasBancariasActionMock(...args),
}));

vi.mock('@/features/contabilidad/components/transferencias-bancarias-table', () => ({
  TransferenciasBancariasTable: () => <div>tabla transferencias</div>,
}));

vi.mock('@/features/contabilidad/components/transferencia-bancaria-form', () => ({
  TransferenciaBancariaForm: () => <div>form transferencia</div>,
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

vi.mock('@/components/ui/animated-number', () => ({
  AnimatedNumber: ({ value }: { value: number }) => <span>{value}</span>,
}));

import TransferenciasBancariasPage from './page';

describe('/busy/contabilidad/transferencias page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTransferenciasBancariasActionMock.mockResolvedValue({
      success: true,
      data: { transferencias: [] },
    });
  });

  it('no redirige mientras auth sigue cargando', async () => {
    useAuthMock.mockReturnValue({
      user: null,
      loading: true,
    });

    render(<TransferenciasBancariasPage />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirige al dashboard contable cuando el plan no incluye transferencias bancarias', async () => {
    useAuthMock.mockReturnValue({
      user: {
        role: 'user',
        planName: 'Básico',
        planFeatures: {
          contabilidad: true,
          'transferencias-bancarias': false,
        },
      },
      loading: false,
    });

    render(<TransferenciasBancariasPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/busy/contabilidad');
    });

    expect(getTransferenciasBancariasActionMock).not.toHaveBeenCalled();
  });

  it('usa el shell contable y conserva las acciones de transferencia', async () => {
    useAuthMock.mockReturnValue({ user: { role: 'admin' }, loading: false });

    render(<TransferenciasBancariasPage />);

    expect(await screen.findByTestId('accounting-page-shell')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Transferencias' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva transferencia' })).toBeInTheDocument();
  });
});
