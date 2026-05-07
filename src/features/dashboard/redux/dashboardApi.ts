import { apiSlice } from "@/lib/redux/services/apiSlice"

export interface DashboardStats {
  totalProductos: number
  totalAlmacenes: number
  totalPuntosVenta: number
  totalVentas: number
  totalMermas: number
  totalTransferencias: number
  totalIngresos: number
  totalGastosMermas: number
  totalBeneficio: number
  valorTotalInventario: number
  datosPorMes: {
    mes: string
    ingresosVentas: number
    ingresosServicios: number
    gastosMermas: number
    gastosDeExplotacion: number
    gastosDeExplotacionCantidad: number
    gastosCompras: number
    gastosComprasCantidad: number
    gastosSalarios: number
    gastosSalariosCantidad: number
    ventasCantidad: number
    ventasServiciosCantidad: number
    mermasCantidad: number
  }[]
  datosPorSemana: {
    semana: string
    ingresosVentas: number
    ingresosServicios: number
    gastosMermas: number
    gastosDeExplotacion: number
    gastosDeExplotacionCantidad: number
    gastosCompras: number
    gastosComprasCantidad: number
    gastosSalarios: number
    gastosSalariosCantidad: number
    ventasCantidad: number
    ventasServiciosCantidad: number
    mermasCantidad: number
  }[]
  ventasDiarias: {
    ventasHoy: number
    ingresosHoy: number
    ventasAyer: number
    ingresosAyer: number
    promedioVentasDiarias: number
    promedioIngresosDiarios: number
    diasConVentas: number
    totalDias: number
    totalIngresosPeriodo: number
    totalCantidadPeriodo: number
  }
  productosMasVendidos: {
    id: string
    nombre: string
    categoria: string
    ventas: number
    ingresos: number
    stock: number
  }[]
  productosStockBajo: {
    id: string
    nombre: string
    stock: number
    stockTotal: number
    stockMinimo: number
    diferencia: number
    umbralUsado: number
    categoria: {
      nombre: string
    }
    unidad: {
      simbolo: string
    }
  }[]
  distribucionStock: {
    categoria: string
    productos: number
    stockTotal: number
    valorTotal: number
  }[]
  transferenciasStats: {
    almacenAAlmacen: number
    almacenAPuntoVenta: number
    puntoVentaAAlmacen: number
    puntoVentaAPuntoVenta: number
  }
}

export const dashboardApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardStats: builder.query<DashboardStats, { ubicacionId?: string; tipoUbicacion?: string } | void>({
      query: (params) => {
        const searchParams = new URLSearchParams()
        if (params?.ubicacionId) searchParams.append("ubicacionId", params.ubicacionId)
        if (params?.tipoUbicacion) searchParams.append("tipoUbicacion", params.tipoUbicacion)
        return `/dashboard/stats?${searchParams.toString()}`
      },
      providesTags: ["Dashboard"],
      keepUnusedDataFor: 10,
    }),
    invalidateDashboard: builder.mutation<void, void>({
      query: () => ({
        url: "/dashboard/stats",
        method: "DELETE",
      }),
      invalidatesTags: ["Dashboard"],
    }),
  }),
})

export const { useGetDashboardStatsQuery, useInvalidateDashboardMutation } = dashboardApi
