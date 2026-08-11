'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageTransition } from "@/components/ui/animations"
import type { AdminFinance } from '@/features/admin'
import { getAdminFinanceAction } from '@/features/admin'

export const dynamic = 'force-dynamic'

/**
 * @description Panel global de finanzas para administradores.
 * @returns {JSX.Element} Vista del panel de finanzas global.
 */
export default function FinanzasPage() {
  const [finance, setFinance] = useState<AdminFinance | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadFinance = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await getAdminFinanceAction()
      if (result.success) {
        setFinance(result.data as AdminFinance)
      } else {
        setError(result.error?.message || 'No se pudo cargar la información financiera')
      }
    } catch (loadError) {
      setFinance(null)
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la información financiera')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadFinance()
  }, [loadFinance])

  const netIncome = finance
    ? Number(finance.revenue.totalIngresos) - Number(finance.gastos.totalMonto)
    : 0

  return (
    <PageTransition className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-primary to-purple shadow-lg">
          <Wallet className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Finanzas Globales</h1>
          <p className="text-muted-foreground text-sm">Consolidación financiera de tenants reales</p>
        </div>
        <Button
          onClick={() => { void loadFinance() }}
          variant="outline"
          disabled={isLoading}
          className="border-slate-200/70 bg-white/70 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/60"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">{error}</p>
        </div>
      ) : finance ? (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos Totales</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  ${Number(finance.revenue.totalIngresos).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {finance.revenue.totalVentas + finance.revenue.totalVentasServicios} transacciones
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Gastos Totales</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  ${Number(finance.gastos.totalMonto).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{finance.gastos.totalGastos} registros</p>
              </CardContent>
            </Card>

            <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Resultado Neto</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${netIncome >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                  ${Math.abs(netIncome).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {netIncome >= 0 ? "Ganancia" : "Pérdida"}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tenants</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{finance.tenantCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Empresas reales con licencia paga</p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed breakdown */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  Desglose de Ingresos
                </CardTitle>
                <CardDescription>Ventas y servicios agregados de tenants reales</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm font-medium">Ventas de Productos</span>
                    <div className="text-right">
                      <p className="text-sm font-semibold">${Number(finance.revenue.totalVentasMonto).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{finance.revenue.totalVentas} transacciones</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm font-medium">Ventas de Servicios</span>
                    <div className="text-right">
                      <p className="text-sm font-semibold">${Number(finance.revenue.totalServiciosMonto).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{finance.revenue.totalVentasServicios} transacciones</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingDown className="h-4 w-4 text-amber-600" />
                  Cuentas por Cobrar / Pagar
                </CardTitle>
                <CardDescription>Saldo pendiente agregado</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-emerald-200/50 bg-emerald-50/30 dark:border-emerald-800/30 dark:bg-emerald-950/10 p-3">
                    <span className="text-sm font-medium">Cuentas por Cobrar</span>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        ${Number(finance.cuentasPorCobrar.saldoPendiente).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">{finance.cuentasPorCobrar.total} cuentas</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-rose-200/50 bg-rose-50/30 dark:border-rose-800/30 dark:bg-rose-950/10 p-3">
                    <span className="text-sm font-medium">Cuentas por Pagar</span>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                        ${Number(finance.cuentasPorPagar.saldoPendiente).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">{finance.cuentasPorPagar.total} cuentas</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">No hay datos financieros reales disponibles</p>
        </div>
      )}
    </PageTransition>
  )
}
