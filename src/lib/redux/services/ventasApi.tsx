import { apiSlice } from "./apiSlice"
import { Venta, VentaStats } from "../../../app/models/model";

// Payload para venta única con múltiples productos
type VentaUnicaRequest = {
  productos: { productoId: string; cantidad: number }[]
  puntoDeVentaId: string
  descuento?: number
  impuestos?: number
  cargoTransporte?: number
  observaciones?: string
  clienteId?: string
  serieId?: string
  fechaVencimiento?: string | null
  tipoVencimiento?: string
}

export const ventasApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getVentas: builder.query<Venta[], void>({
      query: () => "/ventas",
      providesTags: ["Ventas"],
    }),
    getVenta: builder.query<Venta, string>({
      query: (id) => `/ventas/${id}`,
      providesTags: (result, error, id) => [{ type: "Ventas", id }],
    }),
    getVentaStats: builder.query<VentaStats, void>({
      query: () => "/ventas/stats",
      providesTags: ["Ventas", "Dashboard"],
    }),
    // Acepta tanto ventas individuales (existentes) como ventas únicas (con productos[])
    addVenta: builder.mutation<Venta, Omit<Venta, "ventaId" | "createdAt" | "updatedAt"> | VentaUnicaRequest>({
      query: (venta) => ({
        url: "/ventas",
        method: "POST",
        body: venta,
      }),
      invalidatesTags: ["Ventas", "Dashboard"],
    }),
    updateVenta: builder.mutation<Venta, Partial<Venta> & { ventaId: string }>({
      query: ({ ventaId, ...patch }) => ({
        url: `/ventas/${ventaId}`,
        method: "PATCH",
        body: patch,
      }),
      invalidatesTags: (result, error, { ventaId }) => [{ type: "Ventas", ventaId }, "Dashboard"],
    }),
    deleteVenta: builder.mutation<{ success: boolean; id: string }, string>({
      query: (id) => ({
        url: `/ventas/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Ventas", "Dashboard"],
    }),
  }),
})

export const {
  useGetVentasQuery,
  useGetVentaQuery,
  useGetVentaStatsQuery,
  useAddVentaMutation,
  useUpdateVentaMutation,
  useDeleteVentaMutation,
} = ventasApi
