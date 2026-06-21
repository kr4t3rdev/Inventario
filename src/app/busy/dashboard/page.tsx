import { getCurrentUser } from '@/lib/server-actions'
import { getDashboardStatsQuery } from '@/features/dashboard/queries'
import { DashboardShell } from '@/features/dashboard/components/dashboard-shell'
import {
  SectionCards,
  ChartAreaInteractive,
  TopProductsTable,
  StockDistributionChart,
  StockBajoTable,
  TransferenciasStats,
} from '@/features/dashboard/components'
import { MargenBajoTable } from '@/features/dashboard/components/margen-bajo-table'
import { RentabilidadDashboard } from '@/features/dashboard/components/rentabilidad-dashboard'

/**
 * @description Página principal del Dashboard con arquitectura server-first.
 *
 * Nota arquitectónica: el shell sidebar (SidebarProvider + SidebarInset + SiteHeader)
 * pertenece EXCLUSIVAMENTE a src/app/busy/layout.tsx. Esta page no lo duplica.
 *
 * Los datos se obtienen una sola vez via getDashboardStatsQuery() (función server
 * pura, no Server Action) para evitar problemas de contexto de cookies/request.
 *
 * @returns {Promise<JSX.Element>} Página del Dashboard renderizada en servidor
 */
export default async function DashboardPage() {
  const user = await getCurrentUser()

  if (!user) {
    return (
      <DashboardShell>
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="text-destructive text-lg font-medium mb-2">
            Error al cargar el Dashboard
          </div>
          <p className="text-muted-foreground text-sm">
            Usuario no autenticado.
          </p>
        </div>
      </DashboardShell>
    )
  }

  if (!user.tenantId && user.role === 'admin') {
    return (
      <DashboardShell>
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="text-violet-600 text-lg font-medium mb-2">
            Dashboard global de administrador
          </div>
          <p className="text-muted-foreground text-sm max-w-xl">
            Tu usuario tiene acceso global al panel de control admin. El dashboard operativo requiere una membresía de empresa, así que usá el panel admin para métricas globales.
          </p>
        </div>
      </DashboardShell>
    )
  }

  if (!user.tenantId) {
    return (
      <DashboardShell>
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="text-destructive text-lg font-medium mb-2">
            Error al cargar el Dashboard
          </div>
          <p className="text-muted-foreground text-sm">
            Usuario autenticado sin tenant asignado.
          </p>
        </div>
      </DashboardShell>
    )
  }

  const stats = await getDashboardStatsQuery(user.tenantId)

  return (
    <DashboardShell>
      {/* Tarjetas de estadísticas principales */}
      <SectionCards
        dashboardStats={{
          totalIngresos: stats.totalIngresos,
          totalBeneficio: stats.totalBeneficio,
          valorTotalInventario: stats.valorTotalInventario,
          totalProductos: stats.totalProductos,
          ventasDiarias: stats.ventasDiarias as any,
        }}
      />

      {/* Gráficos principales */}
      <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
        <ChartAreaInteractive data={stats.datosPorMes as any} />
        <TopProductsTable productosMasVendidos={stats.productosMasVendidos as any} />
      </div>

      {/* Distribución y análisis */}
      <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
        <StockDistributionChart data={stats.distribucionStock as any} />
        <TransferenciasStats transferenciasStats={stats.transferenciasStats} />
      </div>

      {/* Alertas y productos críticos */}
      <div className="px-4 lg:px-6">
        <StockBajoTable productosStockBajo={stats.productosStockBajo as any} />
      </div>
      <div className="px-4 lg:px-6 mt-4">
        <MargenBajoTable />
      </div>
      <div className="px-4 lg:px-6 mt-4">
        <RentabilidadDashboard />
      </div>
    </DashboardShell>
  )
}
