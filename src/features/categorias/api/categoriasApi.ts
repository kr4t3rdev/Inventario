import { apiSlice } from "@/lib/redux/services/apiSlice"
import type { Categoria, CategoriaHierarchy, CreateCategoriaRequest } from "@/app/models/model"

export const categoriasApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCategorias: builder.query<Categoria[], void>({
      query: () => '/categorias',
      providesTags: ['Categorias'],
    }),
    getCategoria: builder.query<Categoria, string>({
      query: (id) => `/categorias/${id}`,
      providesTags: (result, error, id) => [{ type: "Categorias", id }],
    }),
    addCategoria: builder.mutation<Categoria, CreateCategoriaRequest>({
      query: (categoria) => ({ url: '/categorias', method: 'POST', body: categoria }),
      invalidatesTags: ['Categorias'],
    }),
    updateCategoria: builder.mutation<Categoria, Partial<CreateCategoriaRequest> & { catId: string }>({
      query: ({ catId, ...patch }) => ({ url: `/categorias/${catId}`, method: 'PATCH', body: patch }),
      invalidatesTags: (result, error, { catId }) => [{ type: "Categorias", id: catId }, 'Categorias'],
    }),
    deleteCategoria: builder.mutation<{ success: boolean; id: string; message?: string }, string>({
      query: (id) => ({ url: `/categorias/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Categorias'],
    }),
    getCategoriaHierarchy: builder.query<CategoriaHierarchy[], void>({
      query: () => '/categorias/hierarchy',
      providesTags: ['Categorias'],
    }),
    getSubcategorias: builder.query<Categoria[], string>({
      query: (parentId) => `/categorias/${parentId}/subcategorias`,
      providesTags: (result, error, parentId) => [{ type: "Categorias", id: parentId }],
    }),
  }),
})

export const { useGetCategoriasQuery, useGetCategoriaQuery, useAddCategoriaMutation, useUpdateCategoriaMutation, useDeleteCategoriaMutation, useGetCategoriaHierarchyQuery, useGetSubcategoriasQuery } = categoriasApi
