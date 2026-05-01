import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query"
import { getAuthToken } from "@/lib/token"

export const buildAuthHeader = (token: string): string => {
  if (!token) {
    return ''
  }

  return token.startsWith('Bearer ') ? token : `Bearer ${token}`
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: "/api",
  prepareHeaders: (headers) => {
    const token = buildAuthHeader(getAuthToken())
    if (token) {
      headers.set("Authorization", token)
    }
    return headers
  },
})

const safeBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  try {
    return await rawBaseQuery(args, api, extraOptions)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Mitiga error intermitente de stream ya consumido en Response.clone de RTK Query
    if (errorMessage.includes("Response body is already used")) {
      return {
        error: {
          status: "FETCH_ERROR",
          error: "Response body is already used",
        },
      }
    }

    return {
      error: {
        status: "FETCH_ERROR",
        error: errorMessage,
      },
    }
  }
}

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: safeBaseQuery,
  tagTypes: [
    "Productos",
    "Categorias",
    "Unidades",
    "Vendors",
    "PuntosDeVenta",
    "ListasPrecios",
    "Ventas",
    "Mermas",
    "Transferencias",
    "Almacenes",
    "StockUbicacion",
    "Dashboard",
    "ProductosUbicacion",
    "Notificaciones",
    'Profile',
    'Admin',
    'Empleados',
    'Facturas',
    'PagoSalarios',
    'GastosCompra',
    'GastosDE',
    'GastosConceptos',
    'GastosElementos',
    'ReportesFinancieros',
    'Clientes',
    'Servicios',
    'VentaServicios',
    'ComprasProductos',
    // Contabilidad tags
    'CuentasBancarias',
    'ReconciliacionVentas',
    'ReconciliacionServicios',
    'ReconciliacionGastos',
    'TiposPago',
    'TransferenciasBancarias',
    'AjustesBancarios',
    'Monedas',
    'TasasCambio',
    'ReportesContabilidad',
    'ExchangeRates',
    'CierresContables',
    'InyeccionesCapital',
    'ExchangeIntelligence',
    'CuadreDiario',
    'ActivityLogs',
    'Sessions',
    'LoginHistory',
    'ExpiringUsers',
    'UserMetrics',
    'CuentasPorCobrar',
    'CuentasPorPagar',
    'Ofertas',
    'EquiposReparacion',
    'OrdenesReparacion',
    'Configuracion',
    'Defectaciones',
    'AuditLogs',
    'Anticipos',
    'MesasRestaurante',
    'PlatosRestaurante',
    'ComandasRestaurante',
    'RecetasRestaurante',
    'ProduccionRestaurante',
    'KdsRestaurante',
    // Production module tags
    'RecetasProduccion',
    'OrdenesProduccion',
    'ValesSalida',
    'Conceptos',
    // Cash Loans & Debts
    'PrestamosCash',
    'DeudasCash',
  ],
  endpoints: () => ({}),
})
