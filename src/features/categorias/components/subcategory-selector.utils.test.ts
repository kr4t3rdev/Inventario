import { describe, expect, it } from 'vitest';

import {
  getParentCategories,
  getSubcategoriesForCategory,
} from './subcategory-selector.utils';

const categories = [
  { catId: 'cat-1', nombre: 'Bebidas', parentId: null },
  { catId: 'cat-2', nombre: 'Comidas', parentId: null },
  { catId: 'sub-1', nombre: 'Gaseosas', parentId: 'cat-1' },
  { catId: 'sub-2', nombre: 'Jugos', parentId: 'cat-1' },
  { catId: 'sub-3', nombre: 'Snacks', parentId: 'cat-2' },
];

describe('subcategory selector utils', () => {
  it('devuelve solo las categorías raíz', () => {
    expect(getParentCategories(categories)).toEqual([
      { catId: 'cat-1', nombre: 'Bebidas', parentId: null },
      { catId: 'cat-2', nombre: 'Comidas', parentId: null },
    ]);
  });

  it('devuelve solo las subcategorías de la categoría seleccionada', () => {
    expect(getSubcategoriesForCategory(categories, 'cat-1')).toEqual([
      { catId: 'sub-1', nombre: 'Gaseosas', parentId: 'cat-1' },
      { catId: 'sub-2', nombre: 'Jugos', parentId: 'cat-1' },
    ]);
  });
});
