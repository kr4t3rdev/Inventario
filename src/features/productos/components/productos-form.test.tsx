import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));


vi.mock('@/features/productos/actions', () => ({
  createProductoAction: vi.fn(),
  updateProductoAction: vi.fn(),
}));

vi.mock('@/lib/sileo-shim', () => ({
  sileo: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: {
      planFeatures: {
        'upload-productos-photo': true,
      },
    },
  }),
}));

vi.mock('@/lib/token', () => ({
  getAuthToken: vi.fn(),
}));

vi.mock('@/lib/category-mapping', () => ({
  mapCategoryToSection: vi.fn(),
  mapSubcategoryToSpecific: vi.fn(),
}));

vi.mock('@/features/categorias/components/subcategory-selector', () => ({
  SubcategorySelector: () => null,
}));

vi.mock('./precios-payload', () => ({
  buildPreciosPayload: vi.fn(() => []),
}));

vi.mock('./product-photo-upload', () => ({
  ProductPhotoUpload: () => null,
}));

vi.mock('./clasificador-info-note', () => ({
  ClasificadorInfoNote: () => null,
}));

vi.mock('@/features/mi-empresa/lib/client-mi-empresa', () => ({
  fetchMiEmpresaSettings: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: { usaCodigoEan13: false },
    }),
  ),
}));

import { buildProductosSchema } from './productos-form-schema';
import { ProductoForm } from './productos-form';

const baseProduct = {
  nombre: 'Producto test',
  descripcion: '',
  precioCosto: 100,
  precioVenta: 150,
  stock: 0,
  stockMinimo: 0,
  proveedorCodigo: '',
  categoriaId: 'cat-1',
  subcategoriaId: '',
  unidadId: 'uni-1',
  almacenId: 'alm-1',
  fotos: [],
  vendorId: '',
};

describe('buildProductosSchema', () => {
  it('permite omitir codigoInterno', () => {
    const schema = buildProductosSchema(false);
    const result = schema.safeParse(baseProduct);

    expect(result.success).toBe(true);
  });

  it('permite codigoInterno vacío', () => {
    const schema = buildProductosSchema(false);
    const result = schema.safeParse({ ...baseProduct, codigoInterno: '' });

    expect(result.success).toBe(true);
  });

  it('requiere codigoInterno cuando EAN-13 está activo', () => {
    const schema = buildProductosSchema(true);
    const result = schema.safeParse({ ...baseProduct, codigoInterno: '' });

    expect(result.success).toBe(false);
  });

  it('acepta precioCosto vacío como campo opcional', () => {
    const schema = buildProductosSchema(false);
    const result = schema.safeParse({ ...baseProduct, precioCosto: '' });

    expect(result.success).toBe(true);
  });

  it('rechaza precioVenta vacío aunque el input llegue como string vacío', () => {
    const schema = buildProductosSchema(false);
    const result = schema.safeParse({ ...baseProduct, precioVenta: '' });

    expect(result.success).toBe(false);
  });
});

describe('ProductoForm', () => {
  it('oculta la sección de foto cuando el plan no permite subir fotos de productos', () => {
    render(
      <ProductoForm
        unidades={[{ unidadId: 'uni-1', nombre: 'Unidad', simbolo: 'u' }]}
        almacenes={[{ almacenId: 'alm-1', nombre: 'Principal' }]}
        categorias={[{ catId: 'cat-1', nombre: 'Categoría' }]}
        planFeatures={{ 'upload-productos-photo': false }}
      />,
    );

    expect(screen.queryByText('Foto del producto')).not.toBeInTheDocument();
  });
});
