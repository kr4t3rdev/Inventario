import { describe, expect, it } from 'vitest';

import {
  createCategoriaAction,
  deleteCategoriaAction,
  getCategoriaHierarchyAction,
  getCategoriasAction,
  updateCategoriaAction,
} from '@/features/categorias';

describe('features/categorias barrel exports', () => {
  it('expone las server actions principales', () => {
    expect(getCategoriasAction).toBeDefined();
    expect(getCategoriaHierarchyAction).toBeDefined();
    expect(createCategoriaAction).toBeDefined();
    expect(updateCategoriaAction).toBeDefined();
    expect(deleteCategoriaAction).toBeDefined();
  });
});
