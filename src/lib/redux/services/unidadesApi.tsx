import { Unidad } from "../../../app/models/model";
import { apiSlice } from "./apiSlice";


export const unidadesApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
      getUnidades: builder.query<Unidad[], void>({
        query: () => "/unidades",
        providesTags: ["Unidades"],
      }),
      getUnidad: builder.query<Unidad, string>({
        query: (id) => `/unidades/${id}`,
        providesTags: (result, error, id) => [{ type: "Unidades", id }],
      }),
      addUnidad: builder.mutation<Unidad, Omit<Unidad, "unidadId" | "createdAt" | "updatedAt">>({
        query: (unidad) => ({
          url: "/unidades",
          method: "POST",
          body: unidad,
        }),
        invalidatesTags: ["Unidades"],
      }),
      updateUnidad: builder.mutation<Unidad, Partial<Unidad> & { unidadId: string }>({
        query: ({ unidadId, ...patch }) => ({
          url: `/unidades/${unidadId}`,
          method: "PATCH",
          body: patch,
        }),
        invalidatesTags: (result, error, { unidadId }) => [{ type: "Unidades", unidadId }],
      }),
      deleteUnidad: builder.mutation<{ success: boolean; id: string }, string>({
        query: (id) => ({
          url: `/unidades/${id}`,
          method: "DELETE",
        }),
        invalidatesTags: ["Unidades"],
      }),
    }),
  })
  
  export const {
    useGetUnidadesQuery,
    useGetUnidadQuery,
    useAddUnidadMutation,
    useUpdateUnidadMutation,
    useDeleteUnidadMutation,
  } = unidadesApi