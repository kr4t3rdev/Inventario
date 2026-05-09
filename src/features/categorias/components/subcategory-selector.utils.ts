interface CategoriaFlat {
  catId: string
  nombre: string
  parentId?: string | null
}

/**
 * @description Devuelve únicamente las categorías raíz.
 * @param {CategoriaFlat[]} categories - Lista completa de categorías.
 * @returns {CategoriaFlat[]} Categorías sin parentId.
 */
export function getParentCategories(categories: CategoriaFlat[]): CategoriaFlat[] {
  return categories.filter((category) => !category.parentId);
}

/**
 * @description Filtra las subcategorías de una categoría raíz.
 * @param {CategoriaFlat[]} categories - Lista completa de categorías.
 * @param {string | undefined} categoryId - ID de la categoría padre.
 * @returns {CategoriaFlat[]} Subcategorías asociadas al padre.
 */
export function getSubcategoriesForCategory(
  categories: CategoriaFlat[],
  categoryId?: string,
): CategoriaFlat[] {
  if (!categoryId) {
    return [];
  }

  return categories.filter((category) => category.parentId === categoryId);
}
