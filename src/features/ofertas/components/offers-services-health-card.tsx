'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getOffersServicesHealthAction, type OffersServicesHealthMetrics } from '../actions-health'

interface OffersServicesHealthCardProps { userRole?: string }

/** @description Muestra la salud de ofertas y servicios del tenant para administradores. @param {OffersServicesHealthCardProps} props - Rol autenticado. @returns {React.JSX.Element | null} */
export function OffersServicesHealthCard({ userRole }: OffersServicesHealthCardProps): React.JSX.Element | null {
  const [metrics, setMetrics] = useState<OffersServicesHealthMetrics | null>(null)

  useEffect(() => {
    if (userRole !== 'admin') return
    void getOffersServicesHealthAction().then((result) => {
      if (result.success && result.data) setMetrics(result.data.metrics)
    })
  }, [userRole])

  if (userRole !== 'admin') return null
  if (!metrics) return <Card><CardContent className="flex justify-center py-6"><Loader2 className="size-5 animate-spin" /></CardContent></Card>

  const status = metrics.ofertasCount === 0 && metrics.serviciosCount === 0
    ? { label: 'Sin actividad', className: 'text-muted-foreground', Icon: Loader2 }
    : { label: 'Activo', className: 'text-emerald-600', Icon: CheckCircle2 }
  const StatusIcon = status.Icon

  return <Card>
    <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-lg">Salud operativa: Ofertas y Servicios</CardTitle><Badge variant="outline" className={status.className}><StatusIcon className="mr-1 size-3.5" />{status.label}</Badge></CardHeader>
    <CardContent className="grid grid-cols-2 gap-4">
      <Metric label="Ofertas" value={metrics.ofertasCount} />
      <Metric label="Servicios" value={metrics.serviciosCount} />
    </CardContent>
  </Card>
}

/** @description Presenta una métrica. @param {{ label: string; value: string | number }} props - Etiqueta y valor. @returns {React.JSX.Element} Métrica. */
function Metric({ label, value }: { label: string; value: string | number }): React.JSX.Element {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold tabular-nums">{value}</p></div>
}