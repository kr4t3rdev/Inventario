import { getDashboardStatsAction } from "@/features/dashboard/actions"
import { DashboardShell } from "@/features/dashboard/components/dashboard-shell"
import {
  SectionCards,
  ChartAreaInteractive,
  TopProductsTable,
  StockDistributionChart,
  StockBajoTable,
  TransferenciasStats,
} from "@/features/dashboard/components"

/**
 * @description Página principal del Dashboard con arquitectura server-first.
 *
 * Nota arquitectónica: el shell sidebar (SidebarProvider + SidebarInset + SiteHeader)
 * pertenece EXCLUSIVAMENTE a src/app/busy/layout.tsx. Esta page no lo duplica.
 *
 * Los datos se obtienen una sola vez via getDashboardStatsAction() y se distribuyen
 * como props serializables a los widgets. Los widgets client (charts / motion) se
 * limitan a islands justificadas por interactividad real.
 *
 * @returns {Promise<JSX.Element>} Página del Dashboard renderizada en servidor
 */
export default async function DashboardPage(): Promise<JSX.Element> {
  const result = await getDashboardStatsAction()

  if (!result.success) {
    return (
      <DashboardShell>
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="text-destructive text-lg font-medium mb-2">
            Error al cargar el Dashboard
          </div>
          <p className="text-muted-foreground text-sm">
            {result.error?.message ?? "No se pudieron obtener las estadísticas. Intente nuevamente."}
          </p>
        </div>
      </DashboardShell>
    )
  }

  const stats = result.data

  return (
    <DashboardShell>
      {/* Tarjetas de estadísticas principales */}
      <SectionCards
        dashboardStats={{
          totalIngresos: stats.totalIngresos,
          totalBeneficio: stats.totalBeneficio,
          valorTotalInventario: stats.valorTotalInventario,
          totalProductos: stats.totalProductos,
          ventasDiarias: stats.ventasDiarias,
        }}
      />

      {/* Gráficos principales */}
      <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
        <ChartAreaInteractive data={stats.datosPorMes} />
        <TopProductsTable productosMasVendidos={stats.productosMasVendidos} />
      </div>

      {/* Distribución y análisis */}
      <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
        <StockDistributionChart data={stats.distribucionStock} />
        <TransferenciasStats transferenciasStats={stats.transferenciasStats} />
      </div>

      {/* Alertas y productos críticos */}
      <div className="px-4 lg:px-6">
        <StockBajoTable productosStockBajo={stats.productosStockBajo} />
      </div>
    </DashboardShell>
  )
}
