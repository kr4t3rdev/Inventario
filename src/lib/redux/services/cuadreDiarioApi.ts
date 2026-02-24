import { apiSlice } from './apiSlice'

export interface ResumenDiario {
  fecha: string
  totalVentas: number
  totalServicios: number
  totalIngresos: number
  totalGastosDE: number
  totalSalarios: number
  totalGastosCompra: number
  totalGastos: number
  totalGastosSalarios: number
  diferencia: number
  variacionPorcentual: number
  ingresosAyer: number
}

export interface VentaOperacion {
  id: string
  hora: string
  horaFormateada: string
  cliente: string
  producto: string
  cantidad: number
  productos: number
  total: number
  metodoPago: string
  metodoPagoRaw?: string
  estado: string
  esServicio?: boolean
}

export interface MovimientoCaja {
  id: string
  hora: string
  horaFormateada: string
  tipo: string
  descripcion: string
  monto: number
  referencia: string
}

export interface ResumenMetodoPago {
  metodo: string
  cantidad: number
  total: number
  porcentaje: number
}

export interface CuadreData {
  resumen: ResumenDiario
  ventas: VentaOperacion[]
  gastos: MovimientoCaja[]
  resumenMetodosPago: ResumenMetodoPago[]
  totales: {
    efectivoInicial: number
    efectivoFinal: number
  }
}

export const cuadreDiarioApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCuadreDiario: builder.query<CuadreData, { fecha: string }>({
      query: ({ fecha }) => `/cuadre-diario?fecha=${fecha}`,
      providesTags: [{ type: 'CuadreDiario', id: 'LIST' }]
    })
  })
})

export const { useGetCuadreDiarioQuery } = cuadreDiarioApi
