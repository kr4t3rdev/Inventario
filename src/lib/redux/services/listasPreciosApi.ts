import { apiSlice } from './apiSlice';

export interface ListaPrecio {
  id: string;
  nombre: string;
  descripcion?: string | null;
  esDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListaPrecioPayload {
  nombre: string;
  descripcion?: string;
  esDefault?: boolean;
}

export const listasPreciosApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getListasPrecios: builder.query<ListaPrecio[], void>({
      query: () => '/listas-precios',
      providesTags: ['ListasPrecios'],
    }),
    addListaPrecio: builder.mutation<ListaPrecio, ListaPrecioPayload>({
      query: (body) => ({
        url: '/listas-precios',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['ListasPrecios', 'PuntosDeVenta'],
    }),
    updateListaPrecio: builder.mutation<ListaPrecio, { id: string; body: Partial<ListaPrecioPayload> }>({
      query: ({ id, body }) => ({
        url: `/listas-precios/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['ListasPrecios', 'PuntosDeVenta'],
    }),
    deleteListaPrecio: builder.mutation<{ message: string }, string>({
      query: (id) => ({
        url: `/listas-precios/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['ListasPrecios', 'PuntosDeVenta'],
    }),
  }),
});

export const {
  useGetListasPreciosQuery,
  useAddListaPrecioMutation,
  useUpdateListaPrecioMutation,
  useDeleteListaPrecioMutation,
} = listasPreciosApi;
