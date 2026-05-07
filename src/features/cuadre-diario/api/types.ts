import type { Venta, VentaServicios, GastosDE, GastoCompra, Pagosalario } from "@/generated/prisma"

export type VentaConRelaciones = Venta & {
  producto: { nombre: string | null; precioVenta: number | null } | null
  puntoDeVenta: { nombre: string } | null
  cliente: { nombre: string | null } | null
}

export type VentaConPrecio = Venta & {
  producto: { precioVenta: number | null } | null
}

export type VentaServiciosConRelaciones = VentaServicios & {
  servicio: { nombre: string } | null
  cliente: { nombre: string | null } | null
}

export type GastoCompraConVendor = GastoCompra & {
  vendor: { nombre: string } | null
}

export type PagoSalarioConEmpleado = Pagosalario & {
  empleado: { nombre: string; apellido: string; cargo: string } | null
}

export type TipoPagoSeleccionado = {
  tipoId: string
  nombre: string
}

export type VentaServiciosTotal = {
  total: number | null
}

export interface OperacionFormateada {
  id: string
  hora: string
  horaFormateada: string
  cliente: string
  producto: string
  cantidad: number
  productos: number
  total: number
  metodoPago: string
  metodoPagoRaw: null
  estado: string
  esServicio?: boolean
}

export interface GastoFormateado {
  id: string
  hora: string
  horaFormateada: string
  tipo: string
  descripcion: string
  monto: number
  referencia: string
  bonificaciones?: number | null
  deducciones?: number | null
  observaciones?: string | null
  horasExtras?: number | null
}
