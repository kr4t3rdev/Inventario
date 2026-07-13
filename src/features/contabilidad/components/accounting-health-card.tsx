'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getAccountingHealthAction, type AccountingHealthMetrics } from '../actions-health'

interface AccountingHealthCardProps { userRole?: string }

/** @description Muestra indicadores contables para administradores. @param {AccountingHealthCardProps} props @returns {React.JSX.Element | null} */
export function AccountingHealthCard({ userRole }: AccountingHealthCardProps): React.JSX.Element | null {
  const [metrics, setMetrics] = useState<AccountingHealthMetrics | null>(null)
  useEffect(() => {
    if (userRole !== 'admin') return
    void getAccountingHealthAction().then((r) => { if (r.success && r.data) setMetrics(r.data.metrics) })
  }, [userRole])
  if (userRole !== 'admin') return null
  if (!metrics) return <Card><CardContent className="flex justify-center py-6"><Loader2 className="size-5 animate-spin" /></CardContent></Card>
  const status = !metrics.hasActivePeriod ? { label: 'Bloqueado', className: 'text-destructive', Icon: AlertCircle } : metrics.totalPeriods < 2 ? { label: 'Iniciando', className: 'text-amber-600', Icon: Clock } : { label: 'Operativo', className: 'text-emerald-600', Icon: CheckCircle2 }
  const StatusIcon = status.Icon
  return <Card><CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-lg">Salud operativa: Contabilidad</CardTitle><Badge variant="outline" className={status.className}><StatusIcon className="mr-1 size-3.5" />{status.label}</Badge></CardHeader><CardContent className="grid gap-4"><div className="flex items-center gap-2"><span className="text-sm">Periodo Activo:</span>{metrics.hasActivePeriod ? <Badge variant="default">{metrics.currentPeriodStatus}</Badge> : <Badge variant="destructive">Ninguno</Badge>}</div><div className="flex items-center gap-2"><span className="text-sm">Último Cierre:</span><code className="text-sm">{metrics.lastClosedPeriod ?? 'N/A'}</code></div><Metric label="Total Periodos" value={metrics.totalPeriods} /></CardContent></Card>
}

/** @description Presenta una métrica contable. @param {{ label: string; value: string | number }} props @returns {React.JSX.Element} */
function Metric({ label, value }: { label: string; value: string | number }): React.JSX.Element {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold tabular-nums">{value}</p></div>
}