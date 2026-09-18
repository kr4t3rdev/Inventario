'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, TrendingUp } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getSalesHealthAction, type SalesHealthMetrics } from '../actions-health'

interface SalesHealthCardProps { userRole?: string }

/** @description Muestra la salud de ventas del tenant para administradores. @param {SalesHealthCardProps} props - Rol autenticado. @returns {React.JSX.Element | null} Card o null. */
export function SalesHealthCard({ userRole }: SalesHealthCardProps): React.JSX.Element | null {
  const [metrics, setMetrics] = useState<SalesHealthMetrics | null>(null)

  useEffect(() => {
    if (userRole !== 'admin') return
    void getSalesHealthAction().then((result) => {
      if (result.success && result.data) setMetrics(result.data.metrics)
    })
  }, [userRole])

  if (userRole !== 'admin') return null
  if (!metrics) return <Card><CardContent className="flex justify-center py-6"><Loader2 className="size-5 animate-spin" /></CardContent></Card>

  const status = metrics.ventasCount === 0
    ? { label: 'Inactivo', className: 'text-destructive', Icon: AlertCircle }
    : metrics.ventasCount < 50
      ? { label: 'Bajo Volumen', className: 'text-amber-600', Icon: TrendingUp }
      : { label: 'Activo', className: 'text-emerald-600', Icon: CheckCircle2 }
  const StatusIcon = status.Icon

  return <Card>
    <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-lg">Salud operativa: Ventas</CardTitle><Badge variant="outline" className={status.className}><StatusIcon className="mr-1 size-3.5" />{status.label}</Badge></CardHeader>
    <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-5">
      <Metric label="Ventas" value={metrics.ventasCount} /><Metric label="Total Ventas" value={`$${metrics.ventasTotal.toLocaleString()}`} /><Metric label="Facturas" value={metrics.facturasCount} /><Metric label="Ofertas" value={metrics.ofertasCount} /><Metric label="Servicios" value={metrics.serviciosCount} />
    </CardContent>
  </Card>
}

/** @description Presenta una métrica de salud. @param {{ label: string; value: string | number }} props - Etiqueta y valor. @returns {React.JSX.Element} Métrica. */
function Metric({ label, value }: { label: string; value: string | number }): React.JSX.Element {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold tabular-nums">{value}</p></div>
}
