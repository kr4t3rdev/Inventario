import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockPlanFeatures: Record<string, boolean> = {};
let mockUsaCodigoEan13 = false;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
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
  createCategoriaAction: vi.fn(),
  updateCategoriaAction: vi.fn(),
}));

vi.mock('@/features/productos/components/clasificador-info-note', () => ({
  ClasificadorInfoNote: () => null,
}));

import { CategoryForm } from '@/features/categorias/components/category-form';

describe('CategoryForm', () => {
  beforeEach(() => {
    mockPlanFeatures = { categorias: true, 'categorias-ean13': false };
    mockUsaCodigoEan13 = true;
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(''),
      } as Response),
    ) as unknown as typeof fetch;
  });

  it('mantiene el flujo normal cuando Mi Empresa activa EAN-13 pero el plan no incluye categorias-ean13', async () => {
    render(<CategoryForm />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ingrese el nombre de la categoría')).toBeInTheDocument();
    });

    expect(screen.queryByText('Sección del Clasificador *')).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('usa naming de sección CLAS cuando el plan y Mi Empresa habilitan EAN-13', async () => {
    mockPlanFeatures = { categorias: true, 'categorias-ean13': true };
    mockUsaCodigoEan13 = true;

    render(<CategoryForm />);

    await waitFor(() => {
      expect(screen.getByText('Nueva Sección CLAS')).toBeInTheDocument();
    });
  });
});
