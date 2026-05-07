import type { NextRequest } from "next/server"

export interface CacheEntry {
  data: unknown
  timestamp: number
}

export interface TransferenciaData {
  productoId: string
  cantidad: number
  origenId: string | null
  destinoId: string | null
  puntoDeVentaOrigenId: string | null
  puntoDeVentaDestinoId: string | null
}

export interface VentaData {
  productoId: string | null
  cantidad: number
  descuento: number | null
  total: number | null
  createdAt?: Date
}

export interface VentaServicioData {
  total: number
  cantidad?: number
  createdAt?: Date
}

export interface MermaData {
  cantidad: number
  producto: {
    precioCosto: number | string | null
  }
  createdAt?: Date
}

export interface GastoDEData {
  monto: number
  createdAt?: Date
}

export interface SalarioData {
  salario: number
  createdAt?: Date
}

export interface GastoCompraData {
  total: number
  cantidad: number
  createdAt: Date
}

export interface ProductoData {
  id: string
  stock: number
  precioCosto: number | null
  nombre?: string
  precioVenta?: number | null
}

export type MonthlyAggregation = Record<string, Record<string, number>>

export interface VentaPorMesData {
  createdAt: Date
  cantidad: number
  total: number | null
}

export interface VentaServicioPorMesData {
  createdAt: Date
  total: number
  cantidad: number
}

export interface MermaPorMesData {
  createdAt: Date
  cantidad: number
  producto: { precioCosto: number | string | null }
}

export interface GastoDePorMesData {
  createdAt: Date
  monto: number
}

export interface GastoSalarioPorMesData {
  createdAt: Date
  salario: number
}

export interface GastoCompraPorMesData {
  createdAt: Date
  total: number
  cantidad: number
}

export interface VentaDiariaData {
  createdAt: Date
  cantidad: number
  total: number | null
}

export interface VentaServicioDiariaData {
  createdAt: Date
  total: number
  cantidad: number
}

export interface DiaVentas {
  ingresos: number
  cantidad: number
}

// Wanda types
export interface TipoPagoData {
  tipoId: string
  nombre: string
  descripcion: string | null
  requiereCuenta: boolean
  cuentaDefecto: string | null
  isActive: boolean
}

export interface ReconciliacionData {
  monto: number
  montoConvertido: number | null
  moneda: string
  tasaCambio: number | null
  fechaReconciliacion: Date
  tipoPago: TipoPagoData
  cuentaBancaria: {
    moneda: string
  }
}

export interface VentaWandaData {
  ventaId: string
  total: number | null
  cantidad: number
  createdAt: Date
  puntoDeVenta: {
    nombre: string
  } | null
  empleado: {
    empleadoId: string
    nombre: string
    apellido: string
  } | null
  reconciliaciones: ReconciliacionData[]
}

export interface VentaServicioWandaData {
  ventaServicioId: string
  total: number
  cantidad: number
  createdAt: Date
  reconciliaciones: ReconciliacionData[]
}

export interface MonedaData {
  codigo: string
  nombre: string
  simbolo: string
  esPrincipal: boolean
}
