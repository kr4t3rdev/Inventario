import {
  RecetaProduccion,
  SetIngredientesResponse,
  CreateRecetaProduccionPayload,
  SetIngredientesPayload,
  OrdenProduccion,
  CreateOrdenProduccionPayload,
  ValeSalida,
  CreateValeSalidaPayload,
  PaginatedResponse,
  OrdenesPaginationMeta,
} from '@/app/models/model';
import { apiSlice } from './apiSlice';

/**
 * @description Endpoints RTK Query para el módulo de producción.
 */
export const produccionApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ==================== RECETAS ====================

    /**
     * @description Obtiene recetas de producción.
     */
    getRecetasProduccion: builder.query<PaginatedResponse<RecetaProduccion>, { search?: string; productoId?: string; page?: number; limit?: number } | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.search?.trim()) {
          queryParams.append('search', params.search.trim());
        }
        if (params?.productoId?.trim()) {
          queryParams.append('productoId', params.productoId.trim());
        }
        if (params?.page) {
          queryParams.append('page', String(params.page));
        }
        if (params?.limit) {
          queryParams.append('limit', String(params.limit));
        }
        const query = queryParams.toString();
        return `/produccion/recetas${query ? `?${query}` : ''}`;
      },
      providesTags: ['RecetasProduccion'],
    }),

    /**
     * @description Crea una receta de producción.
     */
    createRecetaProduccion: builder.mutation<RecetaProduccion, CreateRecetaProduccionPayload>({
      query: (payload) => ({
        url: '/produccion/recetas',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['RecetasProduccion'],
    }),

    /**
     * @description Actualiza una receta de producción.
     */
    updateRecetaProduccion: builder.mutation<RecetaProduccion, { recetaId: string; payload: Partial<CreateRecetaProduccionPayload> }>({
      query: ({ recetaId, payload }) => ({
        url: `/produccion/recetas/${recetaId}`,
        method: 'PATCH',
        body: payload,
      }),
      invalidatesTags: ['RecetasProduccion'],
    }),

    /**
     * @description Elimina una receta de producción.
     */
    deleteRecetaProduccion: builder.mutation<{ success: boolean; message: string }, string>({
      query: (recetaId) => ({
        url: `/produccion/recetas/${recetaId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['RecetasProduccion'],
    }),

    /**
     * @description Obtiene una receta específica.
     */
    getRecetaProduccion: builder.query<RecetaProduccion, string>({
      query: (recetaId) => `/produccion/recetas/${recetaId}`,
      providesTags: (result, error, id) => [{ type: 'RecetasProduccion', id }],
    }),

    /**
     * @description Gestiona ingredientes de una receta.
     */
    setIngredientesRecetaProduccion: builder.mutation<SetIngredientesResponse, SetIngredientesPayload>({
      query: ({ recetaId, ingredientes }) => ({
        url: `/produccion/recetas/${recetaId}/ingredientes`,
        method: 'POST',
        body: { ingredientes },
      }),
      invalidatesTags: ['RecetasProduccion'],
    }),

    /**
     * @description Elimina un ingrediente específico de una receta.
     */
    deleteIngredienteRecetaProduccion: builder.mutation<RecetaProduccion, { recetaId: string; productoId: string }>({
      query: ({ recetaId, productoId }) => ({
        url: `/produccion/recetas/${recetaId}/ingredientes?productoId=${productoId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['RecetasProduccion'],
    }),

    // ==================== ÓRDENES DE PRODUCCIÓN ====================

    /**
     * @description Obtiene órdenes de producción.
     */
    getOrdenesProduccion: builder.query<PaginatedResponse<OrdenProduccion, OrdenesPaginationMeta>, { estado?: string; page?: number; limit?: number } | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.estado) {
          queryParams.append('estado', params.estado);
        }
        if (params?.page) {
          queryParams.append('page', String(params.page));
        }
        if (params?.limit) {
          queryParams.append('limit', String(params.limit));
        }
        const query = queryParams.toString();
        return `/produccion/ordenes${query ? `?${query}` : ''}`;
      },
      providesTags: ['OrdenesProduccion'],
    }),

    /**
     * @description Crea una orden de producción.
     */
    createOrdenProduccion: builder.mutation<OrdenProduccion, CreateOrdenProduccionPayload>({
      query: (payload) => ({
        url: '/produccion/ordenes',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['OrdenesProduccion'],
    }),

    /**
     * @description Obtiene una orden específica.
     */
    getOrdenProduccion: builder.query<OrdenProduccion, string>({
      query: (ordenId) => `/produccion/ordenes/${ordenId}`,
      providesTags: (result, error, id) => [{ type: 'OrdenesProduccion', id }],
    }),

    /**
     * @description Aprueba una orden de producción.
     */
    aprobarOrdenProduccion: builder.mutation<OrdenProduccion, { ordenProduccionId: string; userId?: string }>({
      query: ({ ordenProduccionId, ...body }) => ({
        url: `/produccion/ordenes/${ordenProduccionId}/aprobar`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['OrdenesProduccion', 'Productos', 'StockUbicacion'],
    }),

    /**
     * @description Completa una orden de producción.
     */
    completarOrdenProduccion: builder.mutation<OrdenProduccion, { ordenProduccionId: string; userId?: string; cuentaId?: string; tipoPagoId?: string }>({
      query: ({ ordenProduccionId, ...body }) => ({
        url: `/produccion/ordenes/${ordenProduccionId}/completar`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['OrdenesProduccion', 'Productos', 'StockUbicacion'],
    }),

    /**
     * @description Cancela una orden de producción.
     */
    cancelarOrdenProduccion: builder.mutation<OrdenProduccion, { ordenProduccionId: string; userId?: string; observaciones?: string }>({
      query: ({ ordenProduccionId, ...body }) => ({
        url: `/produccion/ordenes/${ordenProduccionId}/cancelar`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['OrdenesProduccion', 'Productos', 'StockUbicacion'],
    }),

    // ==================== VALES DE SALIDA ====================

    /**
     * @description Obtiene los conceptos disponibles (tipos de GastosDE).
     */
    getConceptos: builder.query<string[], void>({
      query: () => '/produccion/conceptos',
      providesTags: ['Conceptos'],
    }),

    /**
     * @description Obtiene vales de salida.
     */
    getValesSalida: builder.query<ValeSalida[], { concepto?: string; estado?: string } | void>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.concepto?.trim()) {
          queryParams.append('concepto', params.concepto.trim());
        }
        if (params?.estado?.trim()) {
          queryParams.append('estado', params.estado.trim());
        }
        const query = queryParams.toString();
        return `/produccion/vales${query ? `?${query}` : ''}`;
      },
      providesTags: ['ValesSalida'],
    }),

    /**
     * @description Crea un vale de salida.
     */
    createValeSalida: builder.mutation<ValeSalida, CreateValeSalidaPayload & { userId?: string }>({
      query: (payload) => ({
        url: '/produccion/vales',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['ValesSalida', 'Productos'],
    }),

    /**
     * @description Obtiene un vale específico.
     */
    getValeSalida: builder.query<ValeSalida, string>({
      query: (valeId) => `/produccion/vales/${valeId}`,
      providesTags: (result, error, id) => [{ type: 'ValesSalida', id }],
    }),

    /**
     * @description Actualiza un vale de salida.
     */
    updateValeSalida: builder.mutation<ValeSalida, { valeSalidaId: string; payload: { concepto?: string; observaciones?: string } }>({
      query: ({ valeSalidaId, payload }) => ({
        url: `/produccion/vales/${valeSalidaId}`,
        method: 'PATCH',
        body: payload,
      }),
      invalidatesTags: ['ValesSalida'],
    }),

    /**
     * @description Anula un vale de salida.
     */
    anularValeSalida: builder.mutation<{ success: boolean; message: string }, string>({
      query: (valeId) => ({
        url: `/produccion/vales/${valeId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['ValesSalida', 'Productos'],
    }),

    /**
     * @description Genera Pdf de un vale.
     */
    getPdfValeSalida: builder.query<{ message: string; data: unknown }, string>({
      query: (valeId) => `/produccion/vales/${valeId}/pdf`,
    }),
  }),
});

export const {
  // Recetas
  useGetRecetasProduccionQuery,
  useCreateRecetaProduccionMutation,
  useUpdateRecetaProduccionMutation,
  useDeleteRecetaProduccionMutation,
  useGetRecetaProduccionQuery,
  useSetIngredientesRecetaProduccionMutation,
  useDeleteIngredienteRecetaProduccionMutation,

  // Órdenes
  useGetOrdenesProduccionQuery,
  useCreateOrdenProduccionMutation,
  useGetOrdenProduccionQuery,
  useAprobarOrdenProduccionMutation,
  useCompletarOrdenProduccionMutation,
  useCancelarOrdenProduccionMutation,

  // Vales
  useGetConceptosQuery,
  useGetValesSalidaQuery,
  useCreateValeSalidaMutation,
  useGetValeSalidaQuery,
  useUpdateValeSalidaMutation,
  useAnularValeSalidaMutation,
  useGetPdfValeSalidaQuery,
} = produccionApi;
