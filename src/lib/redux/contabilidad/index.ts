// Export slice actions and reducer
export { default as contabilidadReducer } from "../slices/contabilidadSlice"
export * from "../slices/contabilidadSlice"

// Export selectors
export * from "../selectors/contabilidadSelectors"

// Export utilities
export * from "../utils/contabilidadUtils"

// Export types (re-export from models)
export type {
  // Core entities
  CuentaBancaria,
  Moneda,
  TasaCambio,
  TransaccionMoneda,
  ReconciliacionVenta,
  ReconciliacionServicio,
  ReconciliacionGasto,
  TipoPago,
  TransferenciaBancaria,
  AjusteBancario,
  
  // Request types
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
  
  // Pending items
  VentaPendiente,
  ServicioPendiente,
  GastoPendiente,
  
  // Reports
  ResumenFinanciero,
  MovimientoBancario,
  ReporteExchange,
  ReporteTransferencias,
} from "../../../app/models/model"

// Export state interface
export type { ContabilidadState } from "../slices/contabilidadSlice"
// Re-export RTK Query hooks from contabilidadApi
export * from '../../../features/contabilidad/api/contabilidadApi'
