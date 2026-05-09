// Server Actions
export { getCategoriasAction, getCategoriaHierarchyAction, createCategoriaAction, updateCategoriaAction, deleteCategoriaAction } from './actions';
// Handlers legacy
export { getCategoriasHandler, createCategoriaHandler, getCategoriaByIdHandler, updateCategoriaHandler, deleteCategoriaHandler, getCategoriasHierarchyHandler, validateCategoriaHandler } from './api/handlers';
// RTK Query (legacy)
export { categoriasApi, useGetCategoriasQuery, useGetCategoriaQuery, useAddCategoriaMutation, useUpdateCategoriaMutation, useDeleteCategoriaMutation, useGetCategoriaHierarchyQuery, useGetSubcategoriasQuery, useMoveCategoriaMutation } from './api/categoriasApi';
export { CategoryForm } from './components/category-form';
export { SubcategoryForm } from './components/subcategory-form';
export { CategoryHierarchyTree } from './components/category-hierarchy-tree';
export { CategoryMoveDialog } from './components/category-move-dialog';
export { DeleteCategoryDialog } from './components/delete-category-dialog';
export { SubcategorySelector } from './components/subcategory-selector';
export type { Categoria, CategoriaHierarchy, CreateCategoriaRequest } from './types';
