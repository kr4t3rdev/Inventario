import { apiSlice } from "./apiSlice"
import type {
  CompraProducto,
  CompraProductoResponse,
} from "@/app/models/model"

type EstadoCompraProducto = 'PENDIENTE' | 'PAGADA'
type FormaPagoCompra = 'PAGO_PARCIAL' | 'PAGO_COMPLETO' | 'ANTICIPO_PAGO'
type TipoOperacionCompra = 'RESTOCK' | 'REGULAR'

interface CompraProductoRequest {
  productoId: string
  precioCosto: number
  cantidad: number
  vendorId: string
  numeroFactura?: string
  facturaUrl?: string
  formaPago: FormaPagoCompra
  estado: EstadoCompraProducto
  descripcionCompra?: string
  fechaVencimiento?: string
  anticipoPagoId?: string
  idempotencyKey?: string
}

interface ComprasProductosQueryParams {
  search?: string
  estado?: EstadoCompraProducto
  formaPago?: FormaPagoCompra
  tipoOperacion?: TipoOperacionCompra
  proveedorId?: string
  fechaDesde?: string
  fechaHasta?: string
  montoMin?: number
  montoMax?: number
  page?: number
  limit?: number
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface ComprasProductosResponse {
  compras: CompraProducto[]
  pagination: PaginationInfo
}

export const comprasProductosApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getComprasProductos: builder.query<ComprasProductosResponse, ComprasProductosQueryParams | void>({
      query: (params) => {
        const searchParams = new URLSearchParams()

        if (params?.search) searchParams.append("search", params.search)
        if (params?.estado) searchParams.append("estado", params.estado)
        if (params?.formaPago) searchParams.append("formaPago", params.formaPago)
        if (params?.tipoOperacion) searchParams.append("tipoOperacion", params.tipoOperacion)
        if (params?.proveedorId) searchParams.append("proveedorId", params.proveedorId)
        if (params?.fechaDesde) searchParams.append("fechaDesde", params.fechaDesde)
        if (params?.fechaHasta) searchParams.append("fechaHasta", params.fechaHasta)
        if (params?.montoMin) searchParams.append("montoMin", params.montoMin.toString())
        if (params?.montoMax) searchParams.append("montoMax", params.montoMax.toString())
        if (params?.page) searchParams.append("page", params.page.toString())
        if (params?.limit) searchParams.append("limit", params.limit.toString())

        const queryString = searchParams.toString()
        return `/compras-productos${queryString ? `?${queryString}` : ""}`
      },
      providesTags: ["ComprasProductos"],
    }),
    createCompraProducto: builder.mutation<CompraProductoResponse, CompraProductoRequest>({
      query: (payload) => ({
        url: "/compras-productos",
        method: "POST",
        body: payload,
      }),
      invalidatesTags: ["ComprasProductos", "Productos", "Dashboard", "GastosCompra"],
    }),
    getCompraProductoById: builder.query<{ compra: CompraProducto }, string>({
      query: (id) => `/compras-productos/${id}`,
      providesTags: (result, error, id) => [{ type: "ComprasProductos", id }],
    }),
    updateCompraProducto: builder.mutation<
      { success: boolean; compra: CompraProducto; message: string },
      { id: string; data: Partial<CompraProductoRequest> }
    >({
      query: ({ id, data }) => ({
        url: `/compras-productos/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        "ComprasProductos",
        { type: "ComprasProductos", id },
        "Productos",
        "Dashboard",
        "GastosCompra",
      ],
    }),
    deleteCompraProducto: builder.mutation<
      { success: boolean; message: string },
      string
    >({
      query: (id) => ({
        url: `/compras-productos/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["ComprasProductos", "Productos", "Dashboard", "GastosCompra"],
    }),
  }),
})

export const {
  useGetComprasProductosQuery,
  useCreateCompraProductoMutation,
  useGetCompraProductoByIdQuery,
  useUpdateCompraProductoMutation,
  useDeleteCompraProductoMutation,
} = comprasProductosApi
