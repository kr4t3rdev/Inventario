
import { apiSlice } from "./apiSlice"
import { Oferta } from "../../../app/models/model";

export const ofertasApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getOfertas: builder.query<Oferta[], { estado?: string } | void>({
      query: (params) => {
        if (params && 'estado' in params) {
          return `/ofertas?estado=${params.estado}`
        }
        return "/ofertas"
      },
      transformResponse: (response: { ofertas: Oferta[] }) => response.ofertas,
      providesTags: ["Ofertas"],
    }),
    getOferta: builder.query<Oferta, string>({
      query: (id) => `/ofertas/${id}`,
      transformResponse: (response: { oferta: Oferta }) => response.oferta,
      providesTags: (result, error, id) => [{ type: "Ofertas", id }],
    }),
    addOferta: builder.mutation<Oferta, Partial<Oferta>>({
      query: (oferta) => ({
        url: "/ofertas",
        method: "POST",
        body: oferta,
      }),
      transformResponse: (response: { oferta: Oferta }) => response.oferta,
      invalidatesTags: ["Ofertas"],
    }),
    updateOferta: builder.mutation<Oferta, Partial<Oferta> & { id: string }>({
      query: ({ id, ...patch }) => ({
        url: `/ofertas/${id}`,
        method: "PATCH",
        body: patch,
      }),
      transformResponse: (response: { oferta: Oferta }) => response.oferta,
      invalidatesTags: (result, error, { id }) => [{ type: "Ofertas", id }],
    }),
    facturarOferta: builder.mutation<any, { id: string, puntoDeVentaId: string, empleadoId?: string, observaciones?: string, cargoTransporte?: number, serieId?: string, fechaVencimiento?: string | null, tipoVencimiento?: string }>({
      query: ({ id, ...body }) => ({
        url: `/ofertas/${id}/facturar`,
        method: "POST",
        body: body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: "Ofertas", id }, "Ventas", "Dashboard"],
    }),
    deleteOferta: builder.mutation<{ message: string }, string>({
      query: (id) => ({
        url: `/ofertas/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Ofertas"],
    }),
  }),
})

export const {
  useGetOfertasQuery,
  useGetOfertaQuery,
  useAddOfertaMutation,
  useUpdateOfertaMutation,
  useFacturarOfertaMutation,
  useDeleteOfertaMutation,
} = ofertasApi
