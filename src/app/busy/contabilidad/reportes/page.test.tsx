import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReplace = vi.fn();
const useAuthMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/busy/contabilidad/reportes',
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/features/contabilidad/components/reportes-analytics-page', () => ({
  ReportesAnalyticsPage: () => <div>analytics</div>,
}));

import ReportesPage from './page';

describe('/busy/contabilidad/reportes page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no redirige mientras la sesión todavía está cargando', async () => {
    useAuthMock.mockReturnValue({
      user: null,
      loading: true,
    });

    render(<ReportesPage />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirige al dashboard de contabilidad cuando el plan no incluye reportes financieros', async () => {
    useAuthMock.mockReturnValue({
      user: {
        role: 'user',
        planName: 'Básico',
        planFeatures: { contabilidad: true, 'reportes-financieros': false },
      },
      loading: false,
    });

    render(<ReportesPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/busy/contabilidad');
    });
  });
});
