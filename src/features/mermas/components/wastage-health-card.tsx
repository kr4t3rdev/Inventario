'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getWastageHealthAction, type WastageHealthMetrics } from '../actions-health'

interface WastageHealthCardProps { userRole?: string }

/** @description Muestra la salud de mermas del tenant para administradores. @param {WastageHealthCardProps} props - Rol autenticado. @returns {React.JSX.Element | null} Card o null. */
export function WastageHealthCard({ userRole }: WastageHealthCardProps): React.JSX.Element | null {
  const [metrics, setMetrics] = useState<WastageHealthMetrics | null>(null)

  useEffect(() => {
    if (userRole !== 'admin') return
    void getWastageHealthAction().then((result) => {
      if (result.success && result.data) setMetrics(result.data.metrics)
    })
  }, [userRole])

  if (userRole !== 'admin') return null
  if (!metrics) return <Card><CardContent className="flex justify-center py-6"><Loader2 className="size-5 animate-spin" /></CardContent></Card>

  const status = metrics.mermasCount === 0
    ? { label: 'Saludable', className: 'text-emerald-600', Icon: CheckCircle2 }
    : metrics.mermasCount <= 10
      ? { label: 'Atención', className: 'text-amber-600', Icon: Clock }
      : metrics.mermasCount <= 50
        ? { label: 'Elevado', className: 'text-orange-600', Icon: AlertCircle }
        : { label: 'Crítico', className: 'text-destructive', Icon: AlertCircle }
  const StatusIcon = status.Icon

  return <Card>
    <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-lg">Salud operativa: Mermas</CardTitle><Badge variant="outline" className={status.className}><StatusIcon className="mr-1 size-3.5" />{status.label}</Badge></CardHeader>
    <CardContent className="grid grid-cols-2 gap-4">
      <Metric label="Cantidad" value={metrics.mermasCount} />
      <Metric label="Costo Total" value={`$${metrics.mermasTotalValue.toLocaleString()}`} />
    </CardContent>
  </Card>
}

/** @description Presenta una métrica de mermas. @param {{ label: string; value: string | number }} props - Etiqueta y valor. @returns {React.JSX.Element} Métrica. */
function Metric({ label, value }: { label: string; value: string | number }): React.JSX.Element {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold tabular-nums">{value}</p></div>
}