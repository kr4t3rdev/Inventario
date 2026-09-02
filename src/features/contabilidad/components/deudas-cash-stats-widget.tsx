'use client'

import { useEffect, useState } from 'react'
import { TrendingDown, AlertCircle, CheckCircle2, Clock } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PanelError, PanelSkeleton } from '@/features/contabilidad/components/panel-states'
import { getDeudasCashStatsAction } from '@/features/contabilidad/actions-deudas-cash'

/**
 * @description Formatea un monto con separador de miles y 2 decimales
 * @param {number} amount - Monto a formatear
 * @returns {string} Monto formateado
 */
function formatAmount(amount: number): string {
  return amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let isActive = true
    setIsLoading(true)
    setError(null)
    getDeudasCashStatsAction()
      .then(r => {
        if (!isActive) return
        if (r.success) setStats(r.data)
        else setError(r.error)
        setIsLoading(false)
      })
      .catch((e) => {
        if (!isActive) return
        setError(e)
        setIsLoading(false)
      })
    return () => { isActive = false }
  }, [retryKey])

  if (isLoading) {
    return <PanelSkeleton title="Deudas en Efectivo" rows={3} />
  }

  if (error || !stats) {
    return (
      <PanelError
        message="No se pudieron cargar las estadísticas."
        onRetry={() => setRetryKey((k) => k + 1)}
      />
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
              Pendiente por pagar
            </p>
            {pendientePorMoneda.map(([moneda, monto]) => (
              <div key={moneda} className="flex justify-between items-center text-sm">
                <span className="text-slate-600 dark:text-slate-400 font-medium">{moneda}</span>
                <span className="font-semibold text-orange-600 dark:text-orange-400">
                  {formatAmount(Number(monto))}
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
