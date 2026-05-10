'use client'

import { useEffect, useState } from 'react'
import { TrendingDown, AlertCircle, CheckCircle2, Clock } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getDeudasCashStatsAction } from '@/features/contabilidad/actions-deudas-cash'

/**
 * @description Formatea un monto con separador de miles y 2 decimales
 * @param {number} amount - Monto a formatear
 * @returns {string} Monto formateado
 */
function formatAmount(amount: number): string {
  return amount.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * @description Widget de estadísticas del módulo de deudas en efectivo para el dashboard de contabilidad.
 * Muestra contadores de deudas por estado y montos pendientes agrupados por moneda.
 * @returns {JSX.Element} Tarjeta con estadísticas de deudas cash
 */
export function DeudasCashStatsWidget() {
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<any>(null)

  useEffect(() => {
    getDeudasCashStatsAction().then(r => {
      if (r.success) setStats(r.data)
      else setError(r.error)
      setIsLoading(false)
    })
  }, [])

  if (isLoading) {
    return (
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    )
  }

  if (error || !stats) {
    return (
      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <TrendingDown className="h-4 w-4 text-orange-500" />
            Deudas en Efectivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No se pudieron cargar las estadísticas.</p>
        </CardContent>
      </Card>
    )
  }

  const pendientePorMoneda = Object.entries(stats.montoPendientePago)
  const hayPendientes = pendientePorMoneda.length > 0

  return (
    <Card className="border-slate-200 dark:border-slate-800 dark:bg-slate-900/15">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <TrendingDown className="h-4 w-4 text-orange-500" />
          Deudas en Efectivo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Contadores por estado */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-xl font-bold text-blue-700 dark:text-blue-300">
              {stats.totalActivas}
            </span>
            <span className="text-xs text-blue-600 dark:text-blue-400">Activas</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-lg bg-red-50 dark:bg-red-900/20 p-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-xl font-bold text-red-700 dark:text-red-300">
              {stats.totalVencidas}
            </span>
            <span className="text-xs text-red-600 dark:text-red-400">Vencidas</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
              {stats.totalPagadas}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400">Pagadas</span>
          </div>
        </div>

        {/* Monto pendiente por moneda */}
        {hayPendientes ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Pendiente por cobrar
            </p>
            {pendientePorMoneda.map(([moneda, monto]) => (
              <div key={moneda} className="flex justify-between items-center text-sm">
                <span className="text-slate-600 dark:text-slate-400 font-medium">{moneda}</span>
                <span className="font-semibold text-orange-600 dark:text-orange-400">
                  {
  // @ts-expect-error
                  formatAmount(monto)
                  }
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-1">
            Sin deudas pendientes
          </p>
        )}
      </CardContent>
    </Card>
  )
}
