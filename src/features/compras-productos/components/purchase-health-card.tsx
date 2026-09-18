'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, TrendingUp } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getPurchaseHealthAction, type PurchaseHealthMetrics } from '../actions-health'

interface PurchaseHealthCardProps { userRole?: string }

/** @description Muestra la salud de compras del tenant para administradores. @param {PurchaseHealthCardProps} props - Rol autenticado. @returns {React.JSX.Element | null} Card o null. */
export function PurchaseHealthCard({ userRole }: PurchaseHealthCardProps): React.JSX.Element | null {
  const [metrics, setMetrics] = useState<PurchaseHealthMetrics | null>(null)

  useEffect(() => {
    if (userRole !== 'admin') return
    void getPurchaseHealthAction().then((result) => {
      if (result.success && result.data) setMetrics(result.data.metrics)
    })
  }, [userRole])

  if (userRole !== 'admin') return null
  if (!metrics) return <Card><CardContent className="flex justify-center py-6"><Loader2 className="size-5 animate-spin" /></CardContent></Card>

  const status = metrics.comprasCount === 0
    ? { label: 'Crítico', className: 'text-destructive', Icon: AlertCircle }
    : metrics.comprasCount < 20
      ? { label: 'Bajo Volumen', className: 'text-amber-600', Icon: TrendingUp }
      : { label: 'Saludable', className: 'text-emerald-600', Icon: CheckCircle2 }
  const StatusIcon = status.Icon

  return <Card>
    <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-lg">Salud operativa: Compras</CardTitle><Badge variant="outline" className={status.className}><StatusIcon className="mr-1 size-3.5" />{status.label}</Badge></CardHeader>
    <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Metric label="Compras" value={metrics.comprasCount} />
      <Metric label="Total Compras" value={`$${metrics.comprasTotal.toLocaleString()}`} />
      <Metric label="Ítems" value={metrics.itemsCount} />
      <Metric label="Proveedores" value={metrics.vendorActiveCount} />
    </CardContent>
  </Card>
}

/** @description Presenta una métrica de compras. @param {{ label: string; value: string | number }} props - Etiqueta y valor. @returns {React.JSX.Element} Métrica. */
function Metric({ label, value }: { label: string; value: string | number }): React.JSX.Element {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold tabular-nums">{value}</p></div>
}