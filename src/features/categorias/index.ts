// Server Actions
export { getCategoriasAction, getCategoriaByIdAction, getCategoriaHierarchyAction, createCategoriaAction, updateCategoriaAction, deleteCategoriaAction } from './actions';
// Hooks
export { useCategorias } from './hooks/use-categorias';
// Handlers legacy
export { getCategoriasHandler, createCategoriaHandler, getCategoriaByIdHandler, updateCategoriaHandler, deleteCategoriaHandler, getCategoriasHierarchyHandler, validateCategoriaHandler } from './api/handlers';
export { CategoryForm } from './components/category-form';
export { SubcategoryForm } from './components/subcategory-form';
export { CategoryHierarchyTree } from './components/category-hierarchy-tree';
export { CategoryMoveDialog } from './components/category-move-dialog';
export { DeleteCategoryDialog } from './components/delete-category-dialog';
export { SubcategorySelector } from './components/subcategory-selector';
export type { Categoria, CategoriaHierarchy, CreateCategoriaRequest } from './types';
