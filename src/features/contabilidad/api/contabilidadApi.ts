import { apiSlice } from "@/lib/redux/services/apiSlice"
import type {
  CuentaBancaria,
  Moneda,
  TasaCambio,
  Anticipo,
  CreateAnticipoRequest,
} from "@/app/models/model"

// Tipo para Cierres Contables
export interface CierreContable {
 cierreId: string;
 tipo: string;
 fechaInicio: Date;
 fechaFin: Date;
 totalVentas: number;
 totalGastos: number;
 totalGastosM: number;
 ganancias: number;
 perdidas: number;
 deudasClientes: number;
 deudasProveedores: number;
 inventarioVendido: number;
 inventarioRebajado: number;
 stockFinal: number;
 margenGanancia: number;
 margenPerdida: number;
 ventasVsExistencias?: string;
 estado: string;
 creadoPor: string;
 aprobadoPor?: string;
 observaciones?: string;
 createdAt: Date;
 updatedAt: Date;
}

export interface CreateCierreRequest {
 tipo: string;
 fechaInicio: string;
 fechaFin: string;
 creadoPor: string;
 observaciones?: string;
}

// Enhanced error handling for API responses
const handleApiError = (error: unknown) => {
  if (typeof error === 'object' && error !== null) {
    const apiError = error as Record<string, unknown>
    if (apiError.status === 'FETCH_ERROR') throw new Error('Error de conexión. Verifique su conexión a internet.')
    if (apiError.status === 'TIMEOUT_ERROR') throw new Error('Tiempo de espera agotado. Intente nuevamente.')
    if (apiError.data && typeof apiError.data === 'object') {
      const errorData = apiError.data as Record<string, unknown>
      if (errorData.error) throw new Error(String(errorData.error))
    }
    const status = Number(apiError.status)
    if (status >= 500) throw new Error('Error del servidor. Intente nuevamente más tarde.')
    if (status === 404) throw new Error('Recurso no encontrado.')
    if (status === 403) throw new Error('No tiene permisos para realizar esta operación.')
    if (status === 401) throw new Error('Sesión expirada. Por favor inicie sesión nuevamente.')
  }
  throw new Error('Error desconocido')
}

const serializeApiError = (response: any) => {
  try {
    handleApiError(response)
    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = typeof response?.status !== 'undefined' ? Number(response.status) : undefined
    const data = typeof response?.data === 'object' ? response.data : undefined
    return { serializedError: true, message, status, data }
  }
}

export const contabilidadApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Cuentas Bancarias (solo lectura — externo: restock-form, mi-empresa-form)
    getCuentasBancarias: builder.query<{ cuentas: CuentaBancaria[], pagination: { page: number, limit: number, total: number, totalPages: number } }, void>({
      query: () => "contabilidad/cuentas",
      providesTags: ["CuentasBancarias"],
    }),

    // Anticipos Disponibles (externo: ventas, compras, ofertas)
    getAnticiposDisponibles: builder.query<{ anticipos: Anticipo[] }, {
      contexto: 'compra' | 'factura'; proveedorId?: string; clienteId?: string; moneda?: string;
    }>({
      query: (params) => ({ url: "contabilidad/anticipos/disponibles", params }),
      providesTags: ["Anticipos"],
    }),

    // Exchange — Monedas (externo: ventas, productos, empleados, servicios)
    getMonedas: builder.query<{ data: Moneda[], success: boolean }, void>({
      query: () => "contabilidad/exchange/monedas",
      providesTags: ["Monedas"],
    }),

    // Exchange — Tasas Actuales (interno: tasa-cambio-dialog, currency-indicator)
    getTasasActuales: builder.query<{ data: { monedaPrincipal: Moneda; tasas: TasaCambio[] } }, void>({
      query: () => "contabilidad/exchange/tasas",
      providesTags: ["TasasCambio"],
    }),

    // Transferencias Bancarias (page no migrada)
    getTransferenciasBancarias: builder.query<{ transferencias: any[], pagination: any }, { fechaInicio?: string; fechaFin?: string; cuentaId?: string }>({
      query: (params) => ({ url: "contabilidad/transferencias", params }),
      providesTags: ["TransferenciasBancarias"],
    }),

    // Cierres Contables (componentes no migrados)
    getCierres: builder.query<CierreContable[], void>({
      query: () => "contabilidad/cierres",
      providesTags: ["CierresContables"],
    }),
    getCierre: builder.query<CierreContable, string>({
      query: (id) => `contabilidad/cierres/${id}`,
      providesTags: (result, error, id) => [{ type: "CierresContables", id }],
    }),
    createCierre: builder.mutation<CierreContable, CreateCierreRequest>({
      query: (cierre) => ({ url: "contabilidad/cierres", method: "POST", body: cierre }),
      invalidatesTags: ["CierresContables"],
    }),
    updateCierre: builder.mutation<CierreContable, { id: string } & Partial<CierreContable>>({
      query: ({ id, ...patch }) => ({ url: `contabilidad/cierres/${id}`, method: "PUT", body: patch }),
      invalidatesTags: ["CierresContables"],
    }),
  }),
})

export const {
  useGetCuentasBancariasQuery,
  useGetAnticiposDisponiblesQuery,
  useGetMonedasQuery,
  useGetTasasActualesQuery,
  useGetTransferenciasBancariasQuery,
  useGetCierresQuery,
  useGetCierreQuery,
  useCreateCierreMutation,
  useUpdateCierreMutation,
} = contabilidadApi
