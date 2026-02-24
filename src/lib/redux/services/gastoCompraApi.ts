import { apiSlice } from './apiSlice';

/**
 * Interfaces para tipos de datos
 */
interface Producto {
  id: string;
  nombre: string;
  categoria?: {
    catId: string;
    nombre: string;
  };
  unidad?: {
    unidadId: string;
    nombre: string;
    simbolo: string;
  };
}

interface Proveedor {
  proveedorId: string;
  nombre: string;
  contacto?: string;
}

interface GastoCompra {
  gastoCompraId: string;
  productoId: string;
  proveedorId: string;
  numeroFactura?: string;
  cantidad: number;
  precioUnitario: number;
  total: number;
  fechaCompra: string;
  descripcion?: string;
  periodo?: string;
  createdAt: string;
  updatedAt: string;
  producto?: Producto;
  proveedor?: Proveedor;
  isRestock: boolean;
  tipoOperacion: 'restock' | 'regular';
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    totalSum: number;
    filters: {
      periodo?: string;
      productoId?: string;
      proveedorId?: string;
      fechaDesde?: string;
      fechaHasta?: string;
      montoMin?: number;
      montoMax?: number;
      tipoOperacion?: string;
      search?: string;
    };
    sort: {
      by: string;
      order: string;
    };
  };
}

interface StatsGeneral {
  totalGastos: number;
  montoTotal: number;
  cantidadTotal: number;
  promedioGasto: number;
  promedioCantidad: number;
  promedioPrecioUnitario: number;
  montoMinimo: number;
  montoMaximo: number;
  fechaPrimerGasto?: string;
  fechaUltimoGasto?: string;
}

interface StatsPorTipo {
  restock: {
    cantidad: number;
    montoTotal: number;
    cantidadProductos: number;
  };
  regular: {
    cantidad: number;
    montoTotal: number;
    cantidadProductos: number;
  };
}

interface TopItem {
  productoId?: string;
  proveedorId?: string;
  _sum: {
    total: number | null;
    cantidad: number | null;
  };
  _count: {
    gastoCompraId: number;
  };
  producto?: Producto;
  proveedor?: Proveedor;
}

interface PeriodoStat {
  periodo: string;
  _sum: {
    total: number | null;
  };
  _count: {
    gastoCompraId: number;
  };
}

interface StatsResponse {
  general: StatsGeneral;
  porTipo: StatsPorTipo;
  topProductos: TopItem[];
  topProveedores: TopItem[];
  porPeriodo: PeriodoStat[];
}

interface ProveedorStat {
  proveedorId: string;
  proveedor?: Proveedor;
  totalGastado: number;
  cantidadCompras: number;
  cantidadProductos: number;
  promedioGasto: number;
  promedioPrecioUnitario: number;
}

interface ProductoStat {
  productoId: string;
  producto?: Producto;
  totalGastado: number;
  cantidadCompras: number;
  cantidadProductos: number;
  promedioGasto: number;
  promedioPrecioUnitario: number;
}

interface PeriodoDetalle {
  periodo: string;
  year: number;
  month: number;
  mesNombre: string;
  totalGastado: number;
  cantidadCompras: number;
  cantidadProductos: number;
  promedioGasto: number;
}

interface QueryParams {
  periodo?: string;
  productoId?: string;
  proveedorId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  montoMin?: number;
  montoMax?: number;
  tipoOperacion?: 'restock' | 'regular';
  includeRestock?: 'true' | 'false';
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'fechaCompra' | 'total' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

interface CreateGastoCompraRequest {
  productoId: string;
  proveedorId: string;
  numeroFactura?: string;
  cantidad: number;
  precioUnitario: number;
  descripcion?: string;
  fechaCompra?: string;
}

/**
 * @description API Slice para gestión de gastos de compra
 */
export const gastoCompraApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * @description Obtener lista paginada de gastos de compra
     */
    getGastosCompra: builder.query<PaginatedResponse<GastoCompra>, QueryParams>({
      query: (params = {}) => {
        const searchParams = new URLSearchParams();
        
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value));
          }
        });
        
        return `/gastos-compra?${searchParams.toString()}`;
      },
      providesTags: (result) =>
        result?.data
          ? [
              ...result.data.map(({ gastoCompraId }) => ({
                type: 'GastosCompra' as const,
                id: gastoCompraId,
              })),
              { type: 'GastosCompra' as const, id: 'LIST' },
            ]
          : [{ type: 'GastosCompra' as const, id: 'LIST' }],
    }),

    /**
     * @description Obtener un gasto de compra por ID
     */
    getGastoCompraById: builder.query<GastoCompra, string>({
      query: (id) => `/gastos-compra/${id}`,
      providesTags: (result, error, id) => [{ type: 'GastosCompra' as const, id }],
    }),

    /**
     * @description Crear un nuevo gasto de compra
     */
    createGastoCompra: builder.mutation<{ data: GastoCompra }, CreateGastoCompraRequest>({
      query: (gastoCompra) => ({
        url: '/gastos-compra',
        method: 'POST',
        body: gastoCompra,
      }),
      invalidatesTags: [{ type: 'GastosCompra', id: 'LIST' }],
    }),

    /**
     * @description Obtener estadísticas generales de gastos de compra
     */
    getGastoCompraStats: builder.query<
      StatsResponse,
      { periodo?: string; fechaDesde?: string; fechaHasta?: string }
    >({
      query: (params = {}) => {
        const searchParams = new URLSearchParams();
        
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value));
          }
        });
        
        return `/gastos-compra/stats?${searchParams.toString()}`;
      },
      providesTags: [{ type: 'GastosCompra' as const, id: 'STATS' }],
    }),

    /**
     * @description Obtener estadísticas agrupadas por proveedor
     */
    getGastoCompraStatsByProveedor: builder.query<
      { data: ProveedorStat[]; meta: { totalProveedores: number; filtros: Record<string, unknown> } },
      { periodo?: string; fechaDesde?: string; fechaHasta?: string; limit?: number }
    >({
      query: (params = {}) => {
        const searchParams = new URLSearchParams();
        
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value));
          }
        });
        
        return `/gastos-compra/stats/proveedor?${searchParams.toString()}`;
      },
      providesTags: [{ type: 'GastosCompra' as const, id: 'STATS_PROVEEDOR' }],
    }),

    /**
     * @description Obtener estadísticas agrupadas por producto
     */
    getGastoCompraStatsByProducto: builder.query<
      { data: ProductoStat[]; meta: { totalProductos: number; filtros: Record<string, unknown> } },
      { periodo?: string; fechaDesde?: string; fechaHasta?: string; limit?: number }
    >({
      query: (params = {}) => {
        const searchParams = new URLSearchParams();
        
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value));
          }
        });
        
        return `/gastos-compra/stats/producto?${searchParams.toString()}`;
      },
      providesTags: [{ type: 'GastosCompra' as const, id: 'STATS_PRODUCTO' }],
    }),

    /**
     * @description Obtener estadísticas agrupadas por período
     */
    getGastoCompraStatsByPeriodo: builder.query<
      {
        data: PeriodoDetalle[];
        resumen: {
          totalPeriodos: number;
          totalGastos: number;
          promedioMensual: number;
          mejorPeriodo: { periodo: string; total: number } | null;
          peorPeriodo: { periodo: string; total: number } | null;
        };
        meta: { filtros: Record<string, unknown> };
      },
      { year?: number; limit?: number }
    >({
      query: (params = {}) => {
        const searchParams = new URLSearchParams();
        
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value));
          }
        });
        
        return `/gastos-compra/stats/periodo?${searchParams.toString()}`;
      },
      providesTags: [{ type: 'GastosCompra' as const, id: 'STATS_PERIODO' }],
    }),

    /**
     * @description Exportar gastos de compra
     */
    exportGastosCompra: builder.query<Blob, { format: 'csv' | 'excel' | 'pdf' } & QueryParams>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value));
          }
        });
        
        return `/gastos-compra/export?${searchParams.toString()}`;
      },
    }),
  }),
});

export const {
  useGetGastosCompraQuery,
  useGetGastoCompraByIdQuery,
  useCreateGastoCompraMutation,
  useGetGastoCompraStatsQuery,
  useGetGastoCompraStatsByProveedorQuery,
  useGetGastoCompraStatsByProductoQuery,
  useGetGastoCompraStatsByPeriodoQuery,
  useExportGastosCompraQuery,
  useLazyExportGastosCompraQuery,
} = gastoCompraApi;
