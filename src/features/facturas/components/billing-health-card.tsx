'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getBillingHealthAction, type BillingHealthMetrics } from '../actions-health'

interface BillingHealthCardProps { userRole?: string }

/** @description Muestra la tasa de formalización para administradores. @param {BillingHealthCardProps} props - Rol autenticado. @returns {React.JSX.Element | null} Card o null. */
export function BillingHealthCard({ userRole }: BillingHealthCardProps): React.JSX.Element | null {
  const [metrics, setMetrics] = useState<BillingHealthMetrics | null>(null)
  useEffect(() => {
    if (userRole !== 'admin') return
    void getBillingHealthAction().then((result) => {
      if (result.success && result.data) setMetrics(result.data.metrics)
    })
  }, [userRole])
  if (userRole !== 'admin') return null
  if (!metrics) return <Card><CardContent className="flex justify-center py-6"><Loader2 className="size-5 animate-spin" /></CardContent></Card>
  const status = metrics.formalizationRate < 30 ? { label: 'Bajo', className: 'text-destructive', Icon: AlertCircle } : metrics.formalizationRate < 70 ? { label: 'Medio', className: 'text-amber-600', Icon: Clock } : { label: 'Alto', className: 'text-emerald-600', Icon: CheckCircle2 }
  const StatusIcon = status.Icon
  return <Card><CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-lg">Salud operativa: Facturación</CardTitle><Badge variant="outline" className={status.className}><StatusIcon className="mr-1 size-3.5" />{status.label}</Badge></CardHeader><CardContent className="grid grid-cols-3 gap-4"><Metric label="Facturas" value={metrics.facturasCount} /><Metric label="Ventas" value={metrics.ventasCount} /><Metric label="Formalización" value={`${metrics.formalizationRate}%`} /></CardContent></Card>
}

/** @description Presenta una métrica de facturación. @param {{ label: string; value: string | number }} props - Etiqueta y valor. @returns {React.JSX.Element} Métrica. */
function Metric({ label, value }: { label: string; value: string | number }): React.JSX.Element {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold tabular-nums">{value}</p></div>
}
