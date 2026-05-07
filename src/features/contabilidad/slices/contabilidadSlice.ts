import { createSlice, createSelector, PayloadAction } from "@reduxjs/toolkit"
import type { RootState } from "@/lib/redux/store"
import {
  CuentaBancaria,
  Moneda,
  TasaCambio,
  ReconciliacionVenta,
  ReconciliacionServicio,
  ReconciliacionGasto,
  TipoPago,
  TransferenciaBancaria,
  AjusteBancario,
  VentaPendiente,
  ServicioPendiente,
  GastoPendiente,
  ResumenFinanciero,
  MovimientoBancario,
  ReporteExchange,
  ReporteTransferencias
} from "@/app/models/model"

// State interface
export interface ContabilidadState {
  // Core entities
  cuentasBancarias: CuentaBancaria[]
  monedas: Moneda[]
  tasasCambio: TasaCambio[]
  tiposPago: TipoPago[]
  
  // Pending reconciliations
  ventasPendientes: VentaPendiente[]
  serviciosPendientes: ServicioPendiente[]
  gastosPendientes: GastoPendiente[]
  
  // Reconciliation history
  reconciliacionesVentas: ReconciliacionVenta[]
  reconciliacionesServicios: ReconciliacionServicio[]
  reconciliacionesGastos: ReconciliacionGasto[]
  
  // Transfers and adjustments
  transferencias: TransferenciaBancaria[]
  ajustes: AjusteBancario[]
  
  // Reports
  resumenFinanciero: ResumenFinanciero | null
  movimientosBancarios: MovimientoBancario[]
  reporteExchange: ReporteExchange | null
  reporteTransferencias: ReporteTransferencias | null
  
  // Exchange system
  monedaPrincipal: string
  tasasActuales: { [key: string]: number }
  
  // UI state
  selectedCuentaId: string | null
  selectedMoneda: string | null
  filtros: {
    fechaInicio: string | null
    fechaFin: string | null
    cuentaId: string | null
    tipo: string | null
  }
  
  // Loading states
  loading: {
    cuentas: boolean
    reconciliacion: boolean
    exchange: boolean
    transferencias: boolean
    reportes: boolean
    ajustes: boolean
  }
  
  // Error handling
  error: string | null
  lastError: {
    operation: string
    message: string
    timestamp: string
  } | null
}

// Initial state
const initialState: ContabilidadState = {
  cuentasBancarias: [],
  monedas: [],
  tasasCambio: [],
  tiposPago: [],
  
  ventasPendientes: [],
  serviciosPendientes: [],
  gastosPendientes: [],
  
  reconciliacionesVentas: [],
  reconciliacionesServicios: [],
  reconciliacionesGastos: [],
  
  transferencias: [],
  ajustes: [],
  
  resumenFinanciero: null,
  movimientosBancarios: [],
  reporteExchange: null,
  reporteTransferencias: null,
  
  monedaPrincipal: "CUP",
  tasasActuales: {},
  
  selectedCuentaId: null,
  selectedMoneda: null,
  filtros: {
    fechaInicio: null,
    fechaFin: null,
    cuentaId: null,
    tipo: null,
  },
  
  loading: {
    cuentas: false,
    reconciliacion: false,
    exchange: false,
    transferencias: false,
    reportes: false,
    ajustes: false,
  },
  
  error: null,
  lastError: null,
}

// Slice
const contabilidadSlice = createSlice({
  name: "contabilidad",
  initialState,
  reducers: {
    // UI actions
    setSelectedCuenta: (state, action: PayloadAction<string | null>) => {
      state.selectedCuentaId = action.payload
    },
    
    setSelectedMoneda: (state, action: PayloadAction<string | null>) => {
      state.selectedMoneda = action.payload
    },
    
    setFiltros: (state, action: PayloadAction<Partial<ContabilidadState["filtros"]>>) => {
      state.filtros = { ...state.filtros, ...action.payload }
    },
    
    clearFiltros: (state) => {
      state.filtros = {
        fechaInicio: null,
        fechaFin: null,
        cuentaId: null,
        tipo: null,
      }
    },
    
    // Loading states
    setLoading: (state, action: PayloadAction<{ operation: keyof ContabilidadState["loading"]; loading: boolean }>) => {
      state.loading[action.payload.operation] = action.payload.loading
    },
    
    // Error handling
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    
    setLastError: (state, action: PayloadAction<{ operation: string; message: string }>) => {
      state.lastError = {
        ...action.payload,
        timestamp: new Date().toISOString(),
      }
      state.error = action.payload.message
    },
    
    clearError: (state) => {
      state.error = null
      state.lastError = null
    },
    
    // Exchange rates cache
    updateTasasActuales: (state, action: PayloadAction<{ [key: string]: number }>) => {
      state.tasasActuales = { ...state.tasasActuales, ...action.payload }
    },
    
    setMonedaPrincipal: (state, action: PayloadAction<string>) => {
      state.monedaPrincipal = action.payload
    },
    
    // Cache management
    invalidateCache: (state, action: PayloadAction<string[]>) => {
      // Clear specific cached data based on tags
      action.payload.forEach(tag => {
        switch (tag) {
          case "cuentas":
            state.cuentasBancarias = []
            break
          case "reconciliacion":
            state.ventasPendientes = []
            state.serviciosPendientes = []
            state.gastosPendientes = []
            break
          case "exchange":
            state.tasasCambio = []
            state.tasasActuales = {}
            break
          case "reportes":
            state.resumenFinanciero = null
            state.movimientosBancarios = []
            state.reporteExchange = null
            state.reporteTransferencias = null
            break
        }
      })
    },
  },
})

// Actions
export const {
  setSelectedCuenta,
  setSelectedMoneda,
  setFiltros,
  clearFiltros,
  setLoading,
  setError,
  setLastError,
  clearError,
  updateTasasActuales,
  setMonedaPrincipal,
  invalidateCache,
} = contabilidadSlice.actions

// Basic selectors
export const selectContabilidadState = (state: RootState) => state.contabilidad
export const selectCuentasBancarias = (state: RootState) => state.contabilidad.cuentasBancarias
export const selectMonedas = (state: RootState) => state.contabilidad.monedas
export const selectTasasCambio = (state: RootState) => state.contabilidad.tasasCambio
export const selectTiposPago = (state: RootState) => state.contabilidad.tiposPago
export const selectSelectedCuentaId = (state: RootState) => state.contabilidad.selectedCuentaId
export const selectSelectedMoneda = (state: RootState) => state.contabilidad.selectedMoneda
export const selectFiltros = (state: RootState) => state.contabilidad.filtros
export const selectLoading = (state: RootState) => state.contabilidad.loading
export const selectError = (state: RootState) => state.contabilidad.error
export const selectLastError = (state: RootState) => state.contabilidad.lastError
export const selectMonedaPrincipal = (state: RootState) => state.contabilidad.monedaPrincipal
export const selectTasasActuales = (state: RootState) => state.contabilidad.tasasActuales

// Computed selectors
export const selectCuentasActivas = createSelector(
  [selectCuentasBancarias],
  (cuentas) => cuentas.filter(cuenta => cuenta.isActive)
)

export const selectCuentasPorMoneda = createSelector(
  [selectCuentasBancarias],
  (cuentas) => {
    const cuentasPorMoneda: { [moneda: string]: CuentaBancaria[] } = {}
    cuentas.forEach(cuenta => {
      if (!cuentasPorMoneda[cuenta.moneda]) {
        cuentasPorMoneda[cuenta.moneda] = []
      }
      cuentasPorMoneda[cuenta.moneda].push(cuenta)
    })
    return cuentasPorMoneda
  }
)

export const selectSaldoTotalPorMoneda = createSelector(
  [selectCuentasBancarias],
  (cuentas) => {
    const saldosPorMoneda: { [moneda: string]: number } = {}
    cuentas
      .filter(cuenta => cuenta.isActive)
      .forEach(cuenta => {
        if (!saldosPorMoneda[cuenta.moneda]) {
          saldosPorMoneda[cuenta.moneda] = 0
        }
        saldosPorMoneda[cuenta.moneda] += cuenta.saldo
      })
    return saldosPorMoneda
  }
)

export const selectSelectedCuenta = createSelector(
  [selectCuentasBancarias, selectSelectedCuentaId],
  (cuentas, selectedId) => 
    selectedId ? cuentas.find(cuenta => cuenta.cuentaId === selectedId) : null
)

export const selectMonedasActivas = createSelector(
  [selectMonedas],
  (monedas) => monedas.filter(moneda => moneda.isActive)
)

export const selectMonedaPrincipalData = createSelector(
  [selectMonedas, selectMonedaPrincipal],
  (monedas, codigoPrincipal) => 
    monedas.find(moneda => moneda.codigo === codigoPrincipal && moneda.esPrincipal)
)

export const selectTasaCambioActual = createSelector(
  [selectTasasCambio, selectTasasActuales],
  (tasasHistoricas, tasasCache) => (monedaOrigen: string, monedaDestino: string) => {
    // First check cache
    const cacheKey = `${monedaOrigen}_${monedaDestino}`
    if (tasasCache[cacheKey]) {
      return tasasCache[cacheKey]
    }
    
    // Then check latest historical rate
    const tasaReciente = tasasHistoricas
      .filter(tasa => tasa.monedaOrigenId === monedaOrigen && tasa.monedaDestino === monedaDestino)
      .sort((a, b) => new Date(b.fechaVigencia).getTime() - new Date(a.fechaVigencia).getTime())[0]
    
    return tasaReciente?.tasa || null
  }
)

export const selectPendingReconciliationsCount = createSelector(
  [
    (state: RootState) => state.contabilidad.ventasPendientes,
    (state: RootState) => state.contabilidad.serviciosPendientes,
    (state: RootState) => state.contabilidad.gastosPendientes,
  ],
  (ventas, servicios, gastos) => ({
    ventas: ventas.filter(v => !v.reconciliada).length,
    servicios: servicios.filter(s => !s.reconciliada).length,
    gastos: gastos.filter(g => !g.reconciliado).length,
    total: ventas.filter(v => !v.reconciliada).length + 
           servicios.filter(s => !s.reconciliada).length + 
           gastos.filter(g => !g.reconciliado).length,
  })
)

export const selectCuentaBalance = createSelector(
  [selectCuentasBancarias, selectTasasActuales, selectMonedaPrincipal],
  (cuentas, tasas, monedaPrincipal) => (cuentaId: string) => {
    const cuenta = cuentas.find(c => c.cuentaId === cuentaId)
    if (!cuenta) return null
    
    let saldoEnMonedaPrincipal = cuenta.saldo
    
    // Convert to main currency if needed
    if (cuenta.moneda !== monedaPrincipal) {
      const tasa = tasas[`${cuenta.moneda}_${monedaPrincipal}`]
      if (tasa) {
        saldoEnMonedaPrincipal = cuenta.saldo * tasa
      }
    }
    
    return {
      saldoOriginal: cuenta.saldo,
      monedaOriginal: cuenta.moneda,
      saldoEnMonedaPrincipal,
      monedaPrincipal,
    }
  }
)

export const selectTotalBalanceInMainCurrency = createSelector(
  [selectCuentasBancarias, selectTasasActuales, selectMonedaPrincipal],
  (cuentas, tasas, monedaPrincipal) => {
    let total = 0
    
    cuentas
      .filter(cuenta => cuenta.isActive)
      .forEach(cuenta => {
        if (cuenta.moneda === monedaPrincipal) {
          total += cuenta.saldo
        } else {
          const tasa = tasas[`${cuenta.moneda}_${monedaPrincipal}`]
          if (tasa) {
            total += cuenta.saldo * tasa
          }
        }
      })
    
    return total
  }
)

export const selectRecentTransfers = createSelector(
  [(state: RootState) => state.contabilidad.transferencias],
  (transferencias) => 
    transferencias
      .sort((a, b) => new Date(b.fechaTransferencia).getTime() - new Date(a.fechaTransferencia).getTime())
      .slice(0, 10)
)

export const selectAccountsRequiringAttention = createSelector(
  [selectCuentasBancarias],
  (cuentas) => 
    cuentas.filter(cuenta => 
      cuenta.isActive && (
        cuenta.saldo < 0 || // Negative balance
        cuenta.saldo < 1000 // Low balance threshold (configurable)
      )
    )
)

export default contabilidadSlice.reducer