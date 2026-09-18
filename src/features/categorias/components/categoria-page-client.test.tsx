import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

let mockPlanFeatures: Record<string, boolean> = {};
let mockUsaCodigoEan13 = false;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));


vi.mock('next/dynamic', () => ({
  default: () => () => <div>stub table</div>,
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: { planFeatures: mockPlanFeatures },
  }),
}));

vi.mock('@/features/mi-empresa/lib/client-mi-empresa', () => ({
  fetchMiEmpresaSettings: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: { usaCodigoEan13: mockUsaCodigoEan13 },
    }),
  ),
}));

vi.mock('@/features/categorias/actions', () => ({
  deleteCategoriaAction: vi.fn(() => Promise.resolve({ success: true })),
}));

import { CategoriaPageClient } from '@/features/categorias/components/categoria-page-client';

describe('CategoriaPageClient', () => {
  const props = {
    categorias: [],
    hierarchy: [],
  };

  it('muestra CTAs CLAS cuando el plan y Mi Empresa habilitan EAN-13', async () => {
    mockPlanFeatures = { categorias: true, 'categorias-ean13': true };
    mockUsaCodigoEan13 = true;

    render(<CategoriaPageClient {...props} />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Nueva Sección CLAS/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /Nuevo Específico CLAS/i })).toBeInTheDocument();
  });
});
