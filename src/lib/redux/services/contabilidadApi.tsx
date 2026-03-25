import { useCallback } from "react"
import { useAppDispatch } from "@/lib/redux/hooks"
import { apiSlice } from "./apiSlice"
import {
  CuentaBancaria,
  Moneda,
  TasaCambio,
  ReconciliacionVenta,
  ReconciliacionServicio,
  ReconciliacionGasto,
  TransferenciaBancaria,
  AjusteBancario,
  CreateCuentaBancariaRequest,
  UpdateCuentaBancariaRequest,
  ReconciliarVentaRequest,
  ReconciliarServicioRequest,
  ReconciliarGastoRequest,
  CreateTransferenciaBancariaRequest,
  CreateAjusteBancarioRequest,
  CreateMonedaRequest,
  UpdateTasaCambioRequest,
  ConvertirMonedaRequest,
  ConvertirMonedaResponse,
  CreateTipoPagoRequest,
  UpdateTipoPagoRequest,
  TipoPagoWithDetails,
  VentaPendiente,
  GastoPendiente,
  ResumenFinanciero,
  MovimientoBancario,
  TransaccionesHistory,
  InyeccionCapital,
  PagoDeuda,
  CreateInyeccionCapitalRequest,
  CreatePagoDeudaRequest,
  CreateCuentaPorCobrarRequest,
  CuentaPorCobrar,
  AuditLog,
  Anticipo,
  CreateAnticipoRequest,
  ExecuteAnticipoRequest,
  ExecuteAnticipoResponse
} from "../../../app/models/model"

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
    
    if (apiError.status === 'FETCH_ERROR') {
      throw new Error('Error de conexión. Verifique su conexión a internet.')
    }
    
    if (apiError.status === 'TIMEOUT_ERROR') {
      throw new Error('Tiempo de espera agotado. Intente nuevamente.')
    }
    
    if (apiError.data && typeof apiError.data === 'object') {
      const errorData = apiError.data as Record<string, unknown>
      if (errorData.error) {
        throw new Error(String(errorData.error))
      }
    }
    
    const status = Number(apiError.status)
    if (status >= 500) {
      throw new Error('Error del servidor. Intente nuevamente más tarde.')
    }
    
    if (status === 404) {
      throw new Error('Recurso no encontrado.')
    }
    
    if (status === 403) {
      throw new Error('No tiene permisos para realizar esta operación.')
    }
    
    if (status === 401) {
      throw new Error('Sesión expirada. Por favor inicie sesión nuevamente.')
    }
  }
  
  throw new Error('Error desconocido')
}

// --- added helper to serialize error instead of throwing ---
const serializeApiError = (response: any) => {
  try {
    // intenta mapear/lanza si hay un error conocido
    handleApiError(response)
    // si no lanza, devolver el response original para que RTK lo procese
    return response
  } catch (err) {
    // devolver un objeto serializable con el mensaje de error
    const message = err instanceof Error ? err.message : String(err)
    const status = typeof response?.status !== 'undefined' ? Number(response.status) : undefined
    const data = typeof response?.data === 'object' ? response.data : undefined
    return { serializedError: true, message, status, data }
  }
}

// Enhanced query with retry and error handling
const createEnhancedQuery = (baseQuery: string | ((arg: unknown) => unknown)) => {
  return typeof baseQuery === 'string' 
    ? {
        url: baseQuery,
        timeout: 30000, // 30 second timeout
      }
    : baseQuery
}

export const contabilidadApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Cuentas Bancarias
    getCuentasBancarias: builder.query<{ 
      cuentas: CuentaBancaria[],
      pagination: { page: number, limit: number, total: number, totalPages: number }
      }, void>({
      query: () => "contabilidad/cuentas",
      providesTags: ["CuentasBancarias"],
    }),
    
    getCuentaBancaria: builder.query<CuentaBancaria, string>({
      query: (id) => `contabilidad/cuentas/${id}`,
      providesTags: (result, error, id) => [{ type: "CuentasBancarias", id }],
    }),
    
    createCuentaBancaria: builder.mutation<CuentaBancaria, CreateCuentaBancariaRequest>({
      query: (cuenta) => ({
        url: "contabilidad/cuentas",
        method: "POST",
        body: cuenta,
        timeout: 30000,
      }),
      invalidatesTags: ["CuentasBancarias", "ReportesContabilidad"],
      transformErrorResponse: (response) => serializeApiError(response),
    }),
    
    updateCuentaBancaria: builder.mutation<CuentaBancaria, { id: string } & UpdateCuentaBancariaRequest>({
      query: ({ id, ...patch }) => ({
        url: `contabilidad/cuentas/${id}`,
        method: "PUT",
        body: patch,
      }),
      invalidatesTags: ["CuentasBancarias"],
    }),
    
    deleteCuentaBancaria: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `contabilidad/cuentas/${id}`,
        method: "DELETE",
        timeout: 30000,
      }),
      invalidatesTags: ["CuentasBancarias"],
      transformErrorResponse: (response) => serializeApiError(response),
    }),

    // Cuentas por Cobrar
    createCuentaPorCobrar: builder.mutation<CuentaPorCobrar, CreateCuentaPorCobrarRequest>({
      query: (data) => ({
        url: "contabilidad/cuentas-por-cobrar",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["CuentasPorCobrar", "Ventas", "ReportesContabilidad"],
    }),

    getAnticipos: builder.query<{ anticipos: Anticipo[] }, {
      tipo?: 'PAGO' | 'COBRO'
      estado?: 'RESERVADO' | 'EJECUTADO' | 'ANULADO'
      proveedorId?: string
      clienteId?: string
      moneda?: string
    }>({
      query: (params) => ({
        url: "contabilidad/anticipos",
        params
      }),
      providesTags: ["Anticipos"],
    }),

    getAnticiposDisponibles: builder.query<{ anticipos: Anticipo[] }, {
      contexto: 'compra' | 'factura'
      proveedorId?: string
      clienteId?: string
      moneda?: string
    }>({
      query: (params) => ({
        url: "contabilidad/anticipos/disponibles",
        params
      }),
      providesTags: ["Anticipos"],
    }),

    createAnticipo: builder.mutation<{ anticipo: Anticipo }, CreateAnticipoRequest>({
      query: (data) => ({
        url: "contabilidad/anticipos",
        method: "POST",
        body: data
      }),
      invalidatesTags: ["Anticipos", "ReportesContabilidad"],
    }),

    executeAnticipo: builder.mutation<{ result: ExecuteAnticipoResponse }, { id: string } & ExecuteAnticipoRequest>({
      query: ({ id, ...data }) => ({
        url: `contabilidad/anticipos/${id}/ejecutar`,
        method: "POST",
        body: data
      }),
      invalidatesTags: ["Anticipos", "ReconciliacionVentas", "ReconciliacionGastos", "ReportesContabilidad"],
      transformErrorResponse: (response) => serializeApiError(response),
    }),

    reverseAnticipo: builder.mutation<
      { result: { anticipoId: string; estado: string; saldoDisponible: number; movimientoId: string } },
      { id: string; documentoDestinoId: string; montoReverso: number; observaciones?: string }
    >({
      query: ({ id, ...data }) => ({
        url: `contabilidad/anticipos/${id}/revertir`,
        method: "POST",
        body: data
      }),
      invalidatesTags: ["Anticipos", "ReconciliacionVentas", "ReconciliacionGastos", "ReportesContabilidad"],
      transformErrorResponse: (response) => serializeApiError(response),
    }),

    // Reconciliación Stats
    getReconciliacionStats: builder.query<{
      modules: {
        ventas: { pending: number, completedToday: number, totalToday: number },
        servicios: { pending: number, completedToday: number, totalToday: number },
        gastos: { pending: number, completedToday: number, totalToday: number }
      },
      stats: {
        totalPending: number,
        completedToday: number,
        reconciledAmount: number,
        efficiency: number
      },
      recentActivity: Array<{
        id: string,
        type: 'venta' | 'servicio' | 'gasto',
        description: string,
        accountName: string,
        amount: number,
        date: string,
        reference: string
      }>
    }, void>({
      query: () => "contabilidad/reconciliacion/stats",
      providesTags: ["ReconciliacionVentas", "ReconciliacionServicios", "ReconciliacionGastos"],
    }),

    // Reconciliación Ventas
    getVentasPendientes: builder.query<{
      ventas: VentaPendiente[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }, {
      fechaInicio?: string;
      fechaFin?: string;
      page?: number;
      limit?: number;
    }>({
      query: ({ fechaInicio, fechaFin, page, limit }) => ({
        url: "contabilidad/reconciliacion/ventas",
        params: {
          fechaDesde: fechaInicio,
          fechaHasta: fechaFin,
          page,
          limit
        },
      }),
      providesTags: ["ReconciliacionVentas"],
    }),
    
    reconciliarVenta: builder.mutation<ReconciliacionVenta, ReconciliarVentaRequest>({
      query: (reconciliacion) => ({
        url: "contabilidad/reconciliacion/ventas",
        method: "POST",
        body: reconciliacion,
      }),
      invalidatesTags: ["ReconciliacionVentas", "CuentasBancarias", "Ventas", "ReportesContabilidad", "CuentasPorCobrar"],
      transformResponse: (response: { reconciliacion?: ReconciliacionVenta } | ReconciliacionVenta) => {
        if (response && typeof response === "object" && "reconciliacion" in response && response.reconciliacion) {
          return response.reconciliacion
        }
        return response as ReconciliacionVenta
      },
      transformErrorResponse: (response) => serializeApiError(response),
    }),

    getHistorialReconciliacionVentas: builder.query<{
      estadisticas: {
        montoConvertidoTotal:number, 
        montoTotal:number,
        porMoneda:[],
        porTipoDePago:[]

      },
      pagination: {

      },
      reconciliaciones: []
    }, { 
      fechaInicio?: string; 
      fechaFin?: string;
      cuentaId?: string;
      page?: number;
      limit?: number;
    }>({
      query: ({ fechaInicio, fechaFin, cuentaId, page, limit }) => ({
        url: "contabilidad/reconciliacion/ventas/historial",
        params: {
          fechaDesde: fechaInicio,
          fechaHasta: fechaFin,
          cuentaId,
          page,
          limit
        },
      }),
      providesTags: ["ReconciliacionVentas"],
    }),

    // Reconciliación Servicios
    getServiciosPendientes: builder.query<{
      ventaServicios: any[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }, {
      fechaDesde?: string;
      fechaHasta?: string;
      page?: number;
      limit?: number;
    }>({
      query: (params) => ({
        url: "contabilidad/reconciliacion/servicios",
        params,
      }),
      providesTags: ["ReconciliacionServicios"],
    }),
    
    reconciliarServicio: builder.mutation<ReconciliacionServicio, ReconciliarServicioRequest>({
      query: (reconciliacion) => ({
        url: "contabilidad/reconciliacion/servicios",
        method: "POST",
        body: reconciliacion,
      }),
      invalidatesTags: ["ReconciliacionServicios", "CuentasBancarias", "Servicios"],
    }),

    getHistorialReconciliacionServicios: builder.query<{ 
      estadisticas: {},
      pagination: {

      },
      reconciliaciones: []
    }, {
      fechaDesde?: string;
      fechaHasta?: string;
      cuentaId?: string;
    }>({
      query: (params) => ({
        url: "contabilidad/reconciliacion/servicios/historial",
        params: {
          fechaDesde: params.fechaDesde,
          fechaHasta: params.fechaHasta,
          cuentaId: params.cuentaId,
        },
      }),
      providesTags: ["ReconciliacionServicios"],
    }),

    // Reconciliación Gastos
    getGastosPendientes: builder.query<{
      gastos: GastoPendiente[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }, {
      fechaDesde?: string;
      fechaHasta?: string;
      tipoGasto?: string;
      periodo?: string;
      soloNoReconciliados?: boolean;
      page?: number;
      limit?: number;
    }>({
      query: (params) => ({
        url: "contabilidad/reconciliacion/gastos",
        params,
      }),
      providesTags: ["ReconciliacionGastos"],
    }),
    
    reconciliarGasto: builder.mutation<ReconciliacionGasto, ReconciliarGastoRequest>({
      query: (reconciliacion) => ({
        url: "contabilidad/reconciliacion/gastos",
        method: "POST",
        body: reconciliacion,
      }),
      invalidatesTags: ["ReconciliacionGastos", "CuentasBancarias", "Empleados", "GastosDE", "GastosCompra", "ReportesContabilidad"],
      transformErrorResponse: (response) => serializeApiError(response),
    }),

    getHistorialReconciliacionGastos: builder.query<{
      reconciliaciones: [],
      estadisticas: {},
      pagination: {},
    }, { 
      fechaInicio?: string; 
      fechaFin?: string;
      cuentaId?: string;
      tipoGasto?: string;
    }>({
      query: (params) => ({
        url: "contabilidad/reconciliacion/gastos/historial",
        params,
      }),
      providesTags: ["ReconciliacionGastos"],
    }),

    // Tipos de Pago
    getTiposPago: builder.query<{
      data: TipoPagoWithDetails[],
      pagination: {
        page:number,
        limits:number,
        total:number,
        totalPage:number
      }
    }, { 
      includeInactive?: boolean;
      requiereCuenta?: boolean;
    }>({
      query: (params) => ({
        url: "contabilidad/tipos-pago",
        params,
      }),
      providesTags: ["TiposPago"],
    }),

    getTipoPago: builder.query<TipoPagoWithDetails, string>({
      query: (id) => `contabilidad/tipos-pago/${id}`,
      providesTags: (result, error, id) => [{ type: "TiposPago", id }],
    }),

    createTipoPago: builder.mutation<TipoPagoWithDetails, CreateTipoPagoRequest>({
      query: (tipoPago) => ({
        url: "contabilidad/tipos-pago",
        method: "POST",
        body: tipoPago,
      }),
      invalidatesTags: ["TiposPago"],
    }),

    updateTipoPago: builder.mutation<TipoPagoWithDetails, { id: string } & UpdateTipoPagoRequest>({
      query: ({ id, ...patch }) => ({
        url: `contabilidad/tipos-pago/${id}`,
        method: "PUT",
        body: patch,
      }),
      invalidatesTags: ["TiposPago"],
    }),

    deleteTipoPago: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `contabilidad/tipos-pago/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["TiposPago"],
    }),

    // Exchange System
    getMonedas: builder.query<{ data: Moneda[] , success: boolean}, void>({
      query: () => "contabilidad/exchange/monedas",
      providesTags: ["Monedas"],
    }),
    
    createMoneda: builder.mutation<Moneda, CreateMonedaRequest>({
      query: (moneda) => ({
        url: "contabilidad/exchange/monedas",
        method: "POST",
        body: moneda,
      }),
      invalidatesTags: ["Monedas"],
    }),
    
    getTasasCambio: builder.query<TasaCambio[], void>({
      query: () => "contabilidad/exchange/tasas",
      providesTags: ["TasasCambio", "ExchangeRates"],
    }),
    
    updateTasaCambio: builder.mutation<TasaCambio, UpdateTasaCambioRequest>({
      query: (tasa) => ({
        url: "contabilidad/exchange/tasas",
        method: "POST",
        body: tasa,
        timeout: 30000,
      }),
      invalidatesTags: ["TasasCambio", "ExchangeRates"],
      transformErrorResponse: (response) => serializeApiError(response),
    }),

    updateMoneda: builder.mutation<Moneda, { codigo: string } & Partial<CreateMonedaRequest>>({
      query: ({ codigo, ...patch }) => ({
        url: `contabilidad/exchange/monedas/${codigo}`,
        method: "PUT",
        body: patch,
      }),
      invalidatesTags: ["Monedas"],
    }),

    getTasasActuales: builder.query<{ data: { monedaPrincipal: Moneda; tasas: TasaCambio[] } }, void>({
      query: () => "contabilidad/exchange/tasas",
      providesTags: ["TasasCambio"],
    }),

    getTasaActual: builder.query<TasaCambio, { monedaOrigen: string; monedaDestino: string }>({
      query: ({ monedaOrigen, monedaDestino }) => ({
        url: "contabilidad/exchange/tasas",
        params: { monedaOrigen, monedaDestino },
      }),
      providesTags: ["TasasCambio"],
    }),

    getHistorialTasas: builder.query<{ tasas: TasaCambio[]; total: number }, {
      monedaOrigen?: string;
      fechaDesde?: string;
      fechaHasta?: string;
      busqueda?: string;
      pagina?: number;
      limite?: number;
    }>({
      query: (params) => ({
        url: "contabilidad/exchange/tasas/historial",
        params,
      }),
      providesTags: ["TasasCambio"],
    }),

    convertirMoneda: builder.mutation<ConvertirMonedaResponse, ConvertirMonedaRequest>({
      query: (conversion) => ({
        url: "contabilidad/exchange/convertir",
        method: "POST",
        body: conversion,
      }),
    }),

    // Transferencias Bancarias
    getTransferenciasBancarias: builder.query<
    {transferencias: TransferenciaBancaria[],
      pagination:{
        page:number,
        limits:number,
        total:number,
        totalPages:number,
      }
    } , { 
      fechaInicio?: string; 
      fechaFin?: string; 
      cuentaId?: string 
    }>({
      query: (params) => ({
        url: "contabilidad/transferencias",
        params,
      }),
      providesTags: ["TransferenciasBancarias"],
    }),
    
    getTransferenciaBancaria: builder.query<TransferenciaBancaria, string>({
      query: (id) => `contabilidad/transferencias/${id}`,
      providesTags: (result, error, id) => [{ type: "TransferenciasBancarias", id }],
    }),
    
    validarTransferencia: builder.mutation<{
      saldoSuficiente: boolean;
      advertencias: string[];
      montoConvertido?: number;
    }, {
      cuentaOrigenId: string;
      cuentaDestinoId: string;
      monto: number;
      motivo: string;
      descripcion?: string;
    }>({
      query: (data) => ({
        url: "contabilidad/transferencias/validar",
        method: "POST",
        body: data,
      }),
    }),
    
    crearTransferencia: builder.mutation<TransferenciaBancaria, CreateTransferenciaBancariaRequest>({
      query: (transferencia) => ({
        url: "contabilidad/transferencias",
        method: "POST",
        body: transferencia,
      }),
      invalidatesTags: ["TransferenciasBancarias", "CuentasBancarias", "ReportesContabilidad"],
    }),
    
    createTransferenciaBancaria: builder.mutation<TransferenciaBancaria, CreateTransferenciaBancariaRequest>({
      query: (transferencia) => ({
        url: "contabilidad/transferencias",
        method: "POST",
        body: transferencia,
        timeout: 45000, // Longer timeout for transfers
      }),
      invalidatesTags: ["TransferenciasBancarias", "CuentasBancarias"],
      transformErrorResponse: (response) => serializeApiError(response),
    }),
    
    descargarComprobanteTransferencia: builder.query<Blob, string>({
      query: (id) => ({
        url: `contabilidad/transferencias/comprobante/${id}`,
        responseHandler: (response) => response.blob(),
      }),
    }),

    // Ajustes Bancarios
    createAjusteBancario: builder.mutation<AjusteBancario, CreateAjusteBancarioRequest>({
      query: (ajuste) => ({
        url: "contabilidad/ajustes",
        method: "POST",
        body: ajuste,
      }),
      invalidatesTags: ["AjustesBancarios", "CuentasBancarias"],
    }),
    
    getAjustesByCuenta: builder.query<{data:{
      ajustes: AjusteBancario[],
      cuentas: CuentaBancaria[],
      estadisticas: {
        periodo: [],
        totalAjustes: number,
        totales: {
          egresos: number,
          ingresos: number,
          neto: number
        }
      },
      pagination: {
        currentPage: number,
        hasNextPage: number,
        hasPrevPage: number,
        limit: number,
        totalCount: number,
        totalPage: number
      }
    }}, string>({
      query: (cuentaId) => `contabilidad/ajustes/${cuentaId}`,
      providesTags: ["AjustesBancarios"],
    }),

    // Reportes
    getResumenFinanciero: builder.query<ResumenFinanciero, {
      fechaInicio?: string;
      fechaFin?: string;
      cuentaId?: string;
    }>({
      query: (params) => ({
        url: "contabilidad/reportes/resumen",
        params,
      }),
      providesTags: ["ReportesContabilidad"],
    }),

    getMovimientos: builder.query<{
      data: MovimientoBancario[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }, {
      busqueda?: string;
      cuentaId?: string;
      tipoMovimiento?: string;
      fechaInicio?: string;
      fechaFin?: string;
      moneda?: string;
      page?: number;
      limit?: number;
    }>({
      query: (params) => ({
        url: "contabilidad/reportes/movimientos",
        params,
      }),
      providesTags: ["ReportesContabilidad"],
    }),

    getCuentaTransactionHistory: builder.query<{
      transacciones: TransaccionesHistory[];
      resumen: {
        saldoActual: number;
        totalIngresos: number;
        totalEgresos: number;
        totalTransferencias: number;
        totalMovimientos: number;
      };
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }, {
      cuentaId: string;
      fechaInicio?: string;
      fechaFin?: string;
      tipoMovimiento?: string;
      page?: number;
      limit?: number;
    }>({
      query: ({ cuentaId, ...params }) => ({
        url: `contabilidad/cuentas/${cuentaId}/historial`,
        params,
      }),
      providesTags: ["ReportesContabilidad"],
    }),

    getExchangeImpactAnalysis: builder.query<{
      resumen: {
        gananciaPerdidaTotal: number;
        totalConvertido: number;
        nivelRiesgo: string;
        volatilidadPromedio: number;
      };
      porMoneda: Array<{
        codigo: string;
        nombre: string;
        impactoTotal: number;
        volumenConvertido: number;
        tasaPromedio: number;
        volatilidad: number;
        transaccionesSignificativas: Array<{
          fecha: string;
          impacto: number;
        }>;
      }>;
      porCuenta: Array<{
        cuentaId: string;
        nombreBanco: string;
        numeroCuenta: string;
        moneda: string;
        totalConversiones: number;
        volumenTotal: number;
        impactoTotal: number;
        nivelRiesgo: string;
      }>;
      recomendaciones: Array<{
        titulo: string;
        descripcion: string;
        prioridad: string;
        impactoEstimado?: number;
      }>;
    }, {
      fechaInicio?: string;
      fechaFin?: string;
      monedaBase?: string;
      tipoAnalisis?: string;
    }>({
      query: (params) => ({
        url: "contabilidad/reportes/exchange-impact",
        params,
      }),
      providesTags: ["ReportesContabilidad"],
    }),

    // Cierres Contables
    getCierres: builder.query<CierreContable[], void>({
      query: () => "contabilidad/cierres",
      providesTags: ["CierresContables"],
    }),

    getCierre: builder.query<CierreContable, string>({
      query: (id) => `contabilidad/cierres/${id}`,
      providesTags: (result, error, id) => [{ type: "CierresContables", id }],
    }),

    createCierre: builder.mutation<CierreContable, CreateCierreRequest>({
      query: (cierre) => ({
        url: "contabilidad/cierres",
        method: "POST",
        body: cierre,
      }),
      invalidatesTags: ["CierresContables"],
    }),

    updateCierre: builder.mutation<CierreContable, { id: string } & Partial<CierreContable>>({
      query: ({ id, ...patch }) => ({
        url: `contabilidad/cierres/${id}`,
        method: "PUT",
        body: patch,
      }),
      invalidatesTags: ["CierresContables"],
    }),

    deleteCierre: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `contabilidad/cierres/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["CierresContables"],
    }),

    // Inyección de Capital
    getInyeccionesCapital: builder.query<{ inyecciones: InyeccionCapital[] }, { tipo?: string }>({
      query: (params) => ({
        url: "contabilidad/capital",
        params
      }),
      providesTags: ["InyeccionesCapital"],
    }),

    createInyeccionCapital: builder.mutation<InyeccionCapital, CreateInyeccionCapitalRequest>({
      query: (data) => ({
        url: "contabilidad/capital",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["InyeccionesCapital", "CuentasBancarias", "ReportesContabilidad"],
    }),

    registrarPagoDeuda: builder.mutation<PagoDeuda, { id: string } & CreatePagoDeudaRequest>({
      query: ({ id, ...data }) => ({
        url: `contabilidad/capital/${id}/pagar`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["InyeccionesCapital", "CuentasBancarias", "ReportesContabilidad"],
    }),

    // Logs de Auditoría
    getAuditLogs: builder.query<{
      logs: AuditLog[];
      total: number;
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }, {
      page?: number;
      limit?: number;
      entidad?: string;
      accion?: string;
    }>({
      query: (params) => ({
        url: "contabilidad/logs",
        params,
      }),
      providesTags: ["AuditLogs"],
    }),
  }),
})

// Mecanismo de invalidación global para datos de contabilidad
export const invalidateContabilidadCache = () => {
  return [
    { type: "CuentasBancarias" as const, id: "LIST" },
    { type: "ReconciliacionVentas" as const, id: "LIST" },
    { type: "ReconciliacionServicios" as const, id: "LIST" },
    { type: "ReconciliacionGastos" as const, id: "LIST" },
    { type: "TransferenciasBancarias" as const, id: "LIST" },
    { type: "AjustesBancarios" as const, id: "LIST" },
    { type: "Monedas" as const, id: "LIST" },
    { type: "TasasCambio" as const, id: "LIST" },
    { type: "TiposPago" as const, id: "LIST" },
    { type: "ReportesContabilidad" as const, id: "LIST" },
    { type: "ExchangeRates" as const, id: "LIST" },
    { type: "CierresContables" as const, id: "LIST" },
    { type: "InyeccionesCapital" as const, id: "LIST" },
    { type: "AuditLogs" as const, id: "LIST" },
    { type: "Anticipos" as const, id: "LIST" }
  ]
}

// Hook personalizado para invalidar cache de contabilidad
export const useInvalidateContabilidadCache = () => {
  const dispatch = useAppDispatch()
  return useCallback(() => {
    dispatch(contabilidadApi.util.invalidateTags(invalidateContabilidadCache()))
  }, [dispatch])
}

// Función utilitaria para invalidar cache desde componentes externos
export const invalidateContabilidadCacheUtil = () => {
  if (typeof window !== 'undefined') {
    // En el navegador, necesitamos acceder al store de Redux
    // Esta función debe ser llamada desde un componente que tenga acceso al dispatch
    console.warn('useInvalidateContabilidadCache debe ser usado dentro de un componente React')
    return false
  }
  return true
}

export const {
  useGetCuentasBancariasQuery,
  useGetCuentaBancariaQuery,
  useCreateCuentaBancariaMutation,
  useUpdateCuentaBancariaMutation,
  useDeleteCuentaBancariaMutation,
  useGetVentasPendientesQuery,
  useReconciliarVentaMutation,
  useGetHistorialReconciliacionVentasQuery,
  useGetServiciosPendientesQuery,
  useReconciliarServicioMutation,
  useGetHistorialReconciliacionServiciosQuery,
  useGetGastosPendientesQuery,
  useReconciliarGastoMutation,
  useGetHistorialReconciliacionGastosQuery,
  useGetTiposPagoQuery,
  useGetMonedasQuery,
  useCreateMonedaMutation,
  useUpdateMonedaMutation,
  useGetTasasCambioQuery,
  useGetTasasActualesQuery,
  useGetTasaActualQuery,
  useGetHistorialTasasQuery,
  useUpdateTasaCambioMutation,
  useConvertirMonedaMutation,
  useGetTransferenciasBancariasQuery,
  useGetTransferenciaBancariaQuery,
  useValidarTransferenciaMutation,
  useCrearTransferenciaMutation,
  useCreateTransferenciaBancariaMutation,
  useLazyDescargarComprobanteTransferenciaQuery,
  useCreateAjusteBancarioMutation,
  useGetAjustesByCuentaQuery,
  useGetResumenFinancieroQuery,
  useGetMovimientosQuery,
  useGetCuentaTransactionHistoryQuery,
  useGetExchangeImpactAnalysisQuery,
  useCreateTipoPagoMutation,
  useUpdateTipoPagoMutation,
  useDeleteTipoPagoMutation,
  useGetTipoPagoQuery,
  useGetCierresQuery,
  useGetCierreQuery,
  useCreateCierreMutation,
  useUpdateCierreMutation,
  useDeleteCierreMutation,
  useGetReconciliacionStatsQuery,
  useCreateCuentaPorCobrarMutation,
  useGetAnticiposQuery,
  useGetAnticiposDisponiblesQuery,
  useCreateAnticipoMutation,
  useExecuteAnticipoMutation,
  useReverseAnticipoMutation,
  useGetInyeccionesCapitalQuery,
  useCreateInyeccionCapitalMutation,
  useRegistrarPagoDeudaMutation,
  useGetAuditLogsQuery
} = contabilidadApi
