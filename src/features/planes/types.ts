/**
 * @description Tipos para el módulo de planes de suscripción.
 *
 * @module features/planes/types
 */

export interface Plan {
  planId: string
  nombre: string
  descripcion: string | null
  precio: number
  duracionDias: number
  maxUsuarios: number
  maxAlmacenes: number
  maxProductos: number
  maxClientes: number
  maxPuntosVenta: number
  maxFacturasMes: number
  maxContratos: number
  incluyeBackups: boolean
  /** Feature flags en JSON: { "ventas-pos": true, "contabilidad": true, "clientes": false, ... } */
  features: Record<string, boolean>
  createdAt: Date
  updatedAt: Date
}

/**
 * @description Datos para crear un plan desde el admin.
 */
export interface CreatePlanInput {
  nombre: string
  descripcion?: string | null
  precio: number
  duracionDias: number
  maxUsuarios: number
  maxAlmacenes: number
  maxProductos: number
  maxClientes: number
  maxPuntosVenta: number
  maxFacturasMes: number
  maxContratos: number
  incluyeBackups: boolean
  features: Record<string, boolean>
}

/**
 * @description Datos para actualizar un plan desde el admin.
 */
export interface UpdatePlanInput {
  planId: string
  nombre?: string
  descripcion?: string | null
  precio?: number
  duracionDias?: number
  maxUsuarios?: number
  maxAlmacenes?: number
  maxProductos?: number
  maxClientes?: number
  maxPuntosVenta?: number
  maxFacturasMes?: number
  maxContratos?: number
  incluyeBackups?: boolean
  features?: Record<string, boolean>
}

/**
 * @description Plan listo para mostrar en la landing page pública.
 */
export interface PlanDisplay {
  planId: string
  name: string
  description: string | null
  price: number
  /** Labels de features habilitados agrupados por categoría */
  featuresByCategory: Record<string, string[]>
  /** Lista plana de bullets para la UI */
  bullets: string[]
  featured: boolean
  cta: string
  limits: {
    maxUsuarios: number
    maxAlmacenes: number
    maxProductos: number
    maxClientes: number
    maxPuntosVenta: number
  }
}
