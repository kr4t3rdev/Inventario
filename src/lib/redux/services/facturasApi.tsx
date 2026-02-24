import { apiSlice } from "./apiSlice"
import { Factura, TipoDocumento } from "../../../app/models/model"

// Payload para actualizar factura
type UpdateFacturaRequest = {
  estado?: 'PENDIENTE' | 'PAGADA' | 'ANULADA' | 'VENCIDA'
  tipoDocumento?: TipoDocumento
  fechaVencimiento?: string | null
  observaciones?: string | null
  terminosPago?: string | null
  metodoPago?: string | null
}

// Respuesta paginada de facturas
interface FacturasResponse {
  facturas: Factura[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  totalsByStatus: Record<string, { count: number; total: number }>
}

export const facturasApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getFacturas: builder.query<FacturasResponse, { page?: number; limit?: number; estado?: string; clienteId?: string; serieId?: string; fechaInicio?: string; fechaFin?: string; search?: string }>({
      query: (params) => {
        const queryParams = new URLSearchParams()
        if (params.page) queryParams.append('page', params.page.toString())
        if (params.limit) queryParams.append('limit', params.limit.toString())
        if (params.estado) queryParams.append('estado', params.estado)
        if (params.clienteId) queryParams.append('clienteId', params.clienteId)
        if (params.serieId) queryParams.append('serieId', params.serieId)
        if (params.fechaInicio) queryParams.append('fechaInicio', params.fechaInicio)
        if (params.fechaFin) queryParams.append('fechaFin', params.fechaFin)
        if (params.search) queryParams.append('search', params.search)
        queryParams.append('includeTotals', 'true')
        
        return `/facturas?${queryParams.toString()}`
      },
      providesTags: ["Facturas"],
    }),
    getFactura: builder.query<Factura, string>({
      query: (id) => `/facturas/${id}`,
      providesTags: (result, error, id) => [{ type: "Facturas", id }],
    }),
    updateFactura: builder.mutation<Factura, { id: string; data: UpdateFacturaRequest }>({
      query: ({ id, data }) => ({
        url: `/facturas/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: "Facturas", id }, "Facturas"],
    }),
    deleteFactura: builder.mutation<{ success: boolean; id: string }, string>({
      query: (id) => ({
        url: `/facturas/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Facturas"],
    }),
  }),
})

export const {
  useGetFacturasQuery,
  useGetFacturaQuery,
  useUpdateFacturaMutation,
  useDeleteFacturaMutation,
} = facturasApi