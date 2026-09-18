import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReplace = vi.fn();
const useAuthMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/busy/contabilidad/logs',
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/features/contabilidad/components/audit-logs-table', () => ({
  AuditLogsTable: () => <div>logs</div>,
}));

import LogsPage from './page';

describe('/busy/contabilidad/logs page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no redirige mientras la sesión todavía está cargando', async () => {
    useAuthMock.mockReturnValue({ user: null, loading: true });
    render(<LogsPage />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('permite acceso al plan básico con contabilidad habilitada', async () => {
    useAuthMock.mockReturnValue({
      user: { role: 'user', planName: 'Básico', planFeatures: { contabilidad: true, 'reportes-financieros': false } },
      loading: false,
    });

    render(<LogsPage />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
