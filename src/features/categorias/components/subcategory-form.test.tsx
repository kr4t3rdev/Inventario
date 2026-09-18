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
  getCategoriasAction: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: [
        { catId: 'root-1', nombre: 'Electrónica', parentId: null },
        { catId: 'child-1', nombre: 'Audio', parentId: 'root-1' },
      ],
    }),
  ),
  createCategoriaAction: vi.fn(),
  updateCategoriaAction: vi.fn(),
}));

vi.mock('@/features/productos/components/clasificador-info-note', () => ({
  ClasificadorInfoNote: () => null,
}));

import { SubcategoryForm } from '@/features/categorias/components/subcategory-form';

describe('SubcategoryForm', () => {
  beforeEach(() => {
    mockPlanFeatures = {};
    mockUsaCodigoEan13 = false;
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(''),
      } as Response),
    ) as unknown as typeof fetch;
  });

  it('permite crear subcategorías normales cuando EAN-13 está desactivado', async () => {
    render(<SubcategoryForm />);

    await waitFor(() => {
      expect(screen.getByText('Categoría Padre')).toBeInTheDocument();
    });

    expect(
      screen.queryByText('Formulario disponible solo en modo EAN-13'),
    ).not.toBeInTheDocument();
  });

  it('cae al flujo normal si Mi Empresa tiene EAN-13 activo pero el plan no incluye categorias-ean13', async () => {
    mockUsaCodigoEan13 = true;
    mockPlanFeatures = { categorias: true, 'categorias-ean13': false };

    render(<SubcategoryForm />);

    await waitFor(() => {
      expect(screen.getByText('Categoría Padre')).toBeInTheDocument();
    });

    expect(screen.queryByText('Sección del Clasificador *')).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
