import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('framer-motion', () => ({
  motion: { div: 'div' },
}));

vi.mock('@/features/productos/actions', () => ({
  createProductoAction: vi.fn(),
  updateProductoAction: vi.fn(),
}));

vi.mock('@/lib/sileo-shim', () => ({
  sileo: { error: vi.fn(), success: vi.fn() },
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

import { buildProductosSchema } from './productos-form';

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
});
