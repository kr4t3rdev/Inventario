import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReplace = vi.fn();
const useAuthMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/busy/contabilidad/capital',
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('@/features/contabilidad/components/capital/capital-form', () => ({
  CapitalForm: () => null,
}));

vi.mock('@/features/contabilidad/components/capital/capital-table', () => ({
  CapitalTable: () => null,
}));

import InyeccionCapitalPage from './page';

describe('/busy/contabilidad/capital page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirige al dashboard de contabilidad cuando el plan no incluye inyección de capital', async () => {
    useAuthMock.mockReturnValue({
      user: {
        role: 'user',
        planName: 'Básico',
        planFeatures: { contabilidad: true, 'inyeccion-capital': false },
      },
    });

    render(<InyeccionCapitalPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/busy/contabilidad');
    });
  });
});
