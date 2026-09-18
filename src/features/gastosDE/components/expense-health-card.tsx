'use client'

import { useEffect, useState } from 'react'
import { Loader2, TrendingUp } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getExpenseHealthAction, type ExpenseHealthMetrics } from '../actions-health'

interface ExpenseHealthCardProps { userRole?: string }

/** @description Muestra la salud de gastos del tenant para administradores. @param {ExpenseHealthCardProps} props - Rol autenticado. @returns {React.JSX.Element | null} */
export function ExpenseHealthCard({ userRole }: ExpenseHealthCardProps): React.JSX.Element | null {
  const [metrics, setMetrics] = useState<ExpenseHealthMetrics | null>(null)

  useEffect(() => {
    if (userRole !== 'admin') return
    void getExpenseHealthAction().then((result) => {
      if (result.success && result.data) setMetrics(result.data.metrics)
    })
  }, [userRole])

  if (userRole !== 'admin') return null
  if (!metrics) return <Card><CardContent className="flex justify-center py-6"><Loader2 className="size-5 animate-spin" /></CardContent></Card>

  const status = metrics.gastosCount === 0
    ? { label: 'Sin actividad', className: 'text-muted-foreground', Icon: TrendingUp }
    : metrics.gastosCount < 50
      ? { label: 'Bajo Volumen', className: 'text-amber-600', Icon: TrendingUp }
      : { label: 'Activo', className: 'text-emerald-600', Icon: TrendingUp }
  const StatusIcon = status.Icon

  return <Card>
    <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-lg">Salud operativa: Gastos</CardTitle><Badge variant="outline" className={status.className}><StatusIcon className="mr-1 size-3.5" />{status.label}</Badge></CardHeader>
    <CardContent className="grid grid-cols-2 gap-4">
      <Metric label="Cantidad" value={metrics.gastosCount} />
      <Metric label="Monto Total" value={`$${metrics.gastosTotal.toLocaleString()}`} />
    </CardContent>
  </Card>
}

/** @description Presenta una métrica de gastos. @param {{ label: string; value: string | number }} props - Etiqueta y valor. @returns {React.JSX.Element} Métrica. */
function Metric({ label, value }: { label: string; value: string | number }): React.JSX.Element {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold tabular-nums">{value}</p></div>
}