import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

let mockPlanFeatures: Record<string, boolean> = {};
let mockUsaCodigoEan13 = false;


vi.mock('@/features/categorias/components/subcategory-form', () => ({
  SubcategoryForm: () => <div>stub subcategory form</div>,
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

import { SubcategoriaNewPageClient } from '@/features/categorias/components/subcategoria-new-page-client';

describe('SubcategoriaNewPageClient', () => {
  beforeEach(() => {
    mockPlanFeatures = {};
    mockUsaCodigoEan13 = false;
  });

  it('usa copy genérico para el flujo de subcategorías', () => {
    render(<SubcategoriaNewPageClient />);

    expect(screen.getByRole('heading', { name: 'Nueva Subcategoría' })).toBeInTheDocument();
    expect(screen.queryByText('Nueva Subcategoría CLAS')).not.toBeInTheDocument();
  });

  it('usa naming de específico CLAS cuando el plan y Mi Empresa habilitan EAN-13', async () => {
    mockPlanFeatures = { categorias: true, 'categorias-ean13': true };
    mockUsaCodigoEan13 = true;

    render(<SubcategoriaNewPageClient />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Nuevo Específico CLAS' })).toBeInTheDocument();
    });
  });
});
