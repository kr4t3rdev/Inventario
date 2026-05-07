export { getCategoriasHandler, createCategoriaHandler, getCategoriaByIdHandler, updateCategoriaHandler, deleteCategoriaHandler, getCategoriasHierarchyHandler, validateCategoriaHandler } from './api/handlers';
export { categoriasApi, useGetCategoriasQuery, useGetCategoriaQuery, useAddCategoriaMutation, useUpdateCategoriaMutation, useDeleteCategoriaMutation, useGetCategoriaHierarchyQuery, useGetSubcategoriasQuery, useMoveCategoriaMutation } from './api/categoriasApi';
export type { Categoria, CategoriaHierarchy, CreateCategoriaRequest } from './types';
