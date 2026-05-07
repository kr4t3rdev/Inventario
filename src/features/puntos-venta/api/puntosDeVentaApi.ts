import { apiSlice } from "@/lib/redux/services/apiSlice"
import type { PuntoDeVenta } from "@/app/models/model"

export const puntosDeVentaApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPuntosDeVenta: builder.query<PuntoDeVenta[], void>({
      query: () => "/puntosDeVenta",
      providesTags: ["PuntosDeVenta"],
    }),
    getPuntoDeVenta: builder.query<PuntoDeVenta, string>({
      query: (id) => `/puntosDeVenta/${id}`,
      providesTags: (result, error, id) => [{ type: "PuntosDeVenta", id }],
    }),
    addPuntoDeVenta: builder.mutation<PuntoDeVenta, Omit<PuntoDeVenta, "pvId" | "createdAt" | "updatedAt">>({
      query: (puntoDeVenta) => ({ url: "/puntosDeVenta", method: "POST", body: puntoDeVenta }),
      invalidatesTags: ["PuntosDeVenta"],
    }),
    updatePuntoDeVenta: builder.mutation<PuntoDeVenta, Partial<PuntoDeVenta> & { pvId: string }>({
      query: ({ pvId, ...patch }) => ({ url: `/puntosDeVenta/${pvId}`, method: "PATCH", body: patch }),
      invalidatesTags: (result, error, { pvId }) => [{ type: "PuntosDeVenta", pvId }],
    }),
    deletePuntoDeVenta: builder.mutation<{ success: boolean; id: string }, string>({
      query: (id) => ({ url: `/puntosDeVenta/${id}`, method: "DELETE" }),
      invalidatesTags: ["PuntosDeVenta"],
    }),
  }),
})

export const {
  useGetPuntosDeVentaQuery, useGetPuntoDeVentaQuery,
  useAddPuntoDeVentaMutation, useUpdatePuntoDeVentaMutation, useDeletePuntoDeVentaMutation,
} = puntosDeVentaApi
