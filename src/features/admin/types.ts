export interface AdminFinance {
  tenantCount: number
  revenue: {
    totalVentas: number
    totalVentasMonto: number
    totalVentasServicios: number
    totalServiciosMonto: number
    totalIngresos: number
  }
  gastos: { totalGastos: number; totalMonto: number }
  cuentasPorCobrar: { total: number; saldoPendiente: number }
  cuentasPorPagar: { total: number; saldoPendiente: number }
}

export interface AdminSystemHealth {
  users: { total: number; byRole: { role: string; count: number }[] }
  tenants: { total: number }
  sessions: { active: number }
  licenses: { total: number; active: number; expiringSoon: number }
}

export interface AdminTenant {
  tenantId: string
  nombre: string
  slug: string | null
  createdAt: string
  updatedAt: string
  totalUsers: number
  activeUsers: number
  totalProductos: number
  totalAlmacenes: number
  totalVentas: number
  plan: string
  planId: string | null
  licenseActive: boolean
  licenseExpiresAt: string | null
  consumption: { usuarios: number; almacenes: number; productos: number }
}
