import { apiSlice } from '@/lib/redux/services/apiSlice'

interface Producto {
  id: string; nombre: string;
  categoria?: { catId: string; nombre: string };
  unidad?: { unidadId: string; nombre: string; simbolo: string };
}

interface Proveedor {
  proveedorId: string; nombre: string; contacto?: string;
}

interface GastoCompra {
  gastoCompraId: string; productoId: string; proveedorId: string;
  numeroFactura?: string; cantidad: number; precioUnitario: number; total: number;
  fechaCompra: string; descripcion?: string; periodo?: string;
  createdAt: string; updatedAt: string;
  producto?: Producto; proveedor?: Proveedor;
  isRestock: boolean; tipoOperacion: 'restock' | 'regular';
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number; hasNext: boolean; hasPrev: boolean; totalSum: number; filters: Record<string, unknown>; sort: { by: string; order: string } };
}

interface StatsResponse {
  general: { totalGastos: number; montoTotal: number; cantidadTotal: number; promedioGasto: number; promedioCantidad: number; promedioPrecioUnitario: number; montoMinimo: number; montoMaximo: number; fechaPrimerGasto?: string; fechaUltimoGasto?: string };
  porTipo: { restock: { cantidad: number; montoTotal: number; cantidadProductos: number }; regular: { cantidad: number; montoTotal: number; cantidadProductos: number } };
  topProductos: any[]; topProveedores: any[]; porPeriodo: any[];
}

interface ProveedorStat {
  proveedorId: string; proveedor?: Proveedor; totalGastado: number; cantidadCompras: number; cantidadProductos: number; promedioGasto: number; promedioPrecioUnitario: number;
}

interface ProductoStat {
  productoId: string; producto?: Producto; totalGastado: number; cantidadCompras: number; cantidadProductos: number; promedioGasto: number; promedioPrecioUnitario: number;
}

interface PeriodoDetalle {
  periodo: string; year: number; month: number; mesNombre: string; totalGastado: number; cantidadCompras: number; cantidadProductos: number; promedioGasto: number;
}

interface QueryParams {
  periodo?: string; productoId?: string; proveedorId?: string; fechaDesde?: string; fechaHasta?: string;
  montoMin?: number; montoMax?: number; tipoOperacion?: 'restock' | 'regular';
  includeRestock?: 'true' | 'false'; search?: string; page?: number; limit?: number;
  sortBy?: 'fechaCompra' | 'total' | 'createdAt'; sortOrder?: 'asc' | 'desc';
}

interface CreateGastoCompraRequest {
  productoId: string; proveedorId: string; numeroFactura?: string; cantidad: number; precioUnitario: number; descripcion?: string; fechaCompra?: string;
}

export const gastoCompraApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getGastosCompra: builder.query<PaginatedResponse<GastoCompra>, QueryParams>({
      query: (params = {}) => {
        const searchParams = new URLSearchParams()
        Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== null) searchParams.append(key, String(value)) })
        return `/gastos-compra?${searchParams.toString()}`
      },
      providesTags: (result) => result?.data ? [...result.data.map(({ gastoCompraId }) => ({ type: 'GastosCompra' as const, id: gastoCompraId })), { type: 'GastosCompra' as const, id: 'LIST' }] : [{ type: 'GastosCompra' as const, id: 'LIST' }],
    }),
    getGastoCompraById: builder.query<GastoCompra, string>({
      query: (id) => `/gastos-compra/${id}`,
      providesTags: (result, error, id) => [{ type: 'GastosCompra' as const, id }],
    }),
    createGastoCompra: builder.mutation<{ data: GastoCompra }, CreateGastoCompraRequest>({
      query: (gastoCompra) => ({ url: '/gastos-compra', method: 'POST', body: gastoCompra }),
      invalidatesTags: [{ type: 'GastosCompra', id: 'LIST' }],
    }),
    getGastoCompraStats: builder.query<StatsResponse, { periodo?: string; fechaDesde?: string; fechaHasta?: string }>({
      query: (params = {}) => { const sp = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v !== undefined) sp.append(k, String(v)) }); return `/gastos-compra/stats?${sp.toString()}` },
      providesTags: [{ type: 'GastosCompra' as const, id: 'STATS' }],
    }),
    getGastoCompraStatsByProveedor: builder.query<{ data: ProveedorStat[]; meta: { totalProveedores: number; filtros: Record<string, unknown> } }, { periodo?: string; fechaDesde?: string; fechaHasta?: string; limit?: number }>({
      query: (params = {}) => { const sp = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v !== undefined) sp.append(k, String(v)) }); return `/gastos-compra/stats/proveedor?${sp.toString()}` },
      providesTags: [{ type: 'GastosCompra' as const, id: 'STATS_PROVEEDOR' }],
    }),
    getGastoCompraStatsByProducto: builder.query<{ data: ProductoStat[]; meta: { totalProductos: number; filtros: Record<string, unknown> } }, { periodo?: string; fechaDesde?: string; fechaHasta?: string; limit?: number }>({
      query: (params = {}) => { const sp = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v !== undefined) sp.append(k, String(v)) }); return `/gastos-compra/stats/producto?${sp.toString()}` },
      providesTags: [{ type: 'GastosCompra' as const, id: 'STATS_PRODUCTO' }],
    }),
    getGastoCompraStatsByPeriodo: builder.query<{ data: PeriodoDetalle[]; resumen: { totalPeriodos: number; totalGastos: number; promedioMensual: number; mejorPeriodo: { periodo: string; total: number } | null; peorPeriodo: { periodo: string; total: number } | null }; meta: { filtros: Record<string, unknown> } }, { year?: number; limit?: number }>({
      query: (params = {}) => { const sp = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v !== undefined) sp.append(k, String(v)) }); return `/gastos-compra/stats/periodo?${sp.toString()}` },
      providesTags: [{ type: 'GastosCompra' as const, id: 'STATS_PERIODO' }],
    }),
    exportGastosCompra: builder.query<Blob, { format: 'csv' | 'excel' | 'pdf' } & QueryParams>({
      query: (params) => { const sp = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v !== undefined) sp.append(k, String(v)) }); return `/gastos-compra/export?${sp.toString()}` },
    }),
  }),
})

export const { useGetGastosCompraQuery, useGetGastoCompraByIdQuery, useCreateGastoCompraMutation, useGetGastoCompraStatsQuery, useGetGastoCompraStatsByProveedorQuery, useGetGastoCompraStatsByProductoQuery, useGetGastoCompraStatsByPeriodoQuery, useExportGastosCompraQuery, useLazyExportGastosCompraQuery } = gastoCompraApi
