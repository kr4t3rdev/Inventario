'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Clock, RefreshCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LastUpdatedLabel, PanelError, PanelSkeleton, StaleBanner } from '@/features/contabilidad/components/panel-states'
import { getAccountingHealthAction, type AccountingHealthMetrics } from '../actions-health'

interface AccountingHealthCardProps { userRole?: string }

interface HealthStatusVisual {
  label: string
  className: string
  Icon: typeof AlertCircle
}

/**
 * @description Deriva el estado visual de salud operativa a partir de las métricas.
 * @param {AccountingHealthMetrics} metrics - Métricas del período contable.
 * @returns {HealthStatusVisual} Etiqueta, clase de color e icono del estado.
 */
export function deriveHealthStatus(metrics: AccountingHealthMetrics): HealthStatusVisual {
  if (!metrics.hasActivePeriod) {
    return { label: 'Bloqueado', className: 'text-destructive', Icon: AlertCircle }
  }
  if (metrics.totalPeriods < 2) {
    return { label: 'Iniciando', className: 'text-amber-600', Icon: Clock }
  }
  return { label: 'Operativo', className: 'text-emerald-600', Icon: CheckCircle2 }
}

/**
 * @description Muestra indicadores contables para administradores con estados de
 * carga, error con reintento y datos listos.
 * @param {AccountingHealthCardProps} props - Rol del usuario actual.
 * @returns {React.JSX.Element | null} Tarjeta de salud operativa o null.
 */
export function AccountingHealthCard({ userRole }: AccountingHealthCardProps): React.JSX.Element | null {
  const [metrics, setMetrics] = useState<AccountingHealthMetrics | null>(null)
  const [error, setError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [actualizadoEn, setActualizadoEn] = useState<Date | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  const refetch = useCallback(() => setRetryKey((k) => k + 1), [])

  useEffect(() => {
    if (userRole !== 'admin') return
    let isActive = true
    setIsLoading(true)
    setError(false)
    void getAccountingHealthAction()
      .then((r) => {
        if (!isActive) return
        if (r.success && r.data) {
          setMetrics(r.data.metrics)
          setActualizadoEn(new Date())
          setError(false)
        } else {
          setError(true)
        }
        setIsLoading(false)
      })
      .catch(() => {
        if (!isActive) return
        setError(true)
        setIsLoading(false)
      })
    return () => { isActive = false }
  }, [userRole, retryKey])

  if (userRole !== 'admin') return null

  if (isLoading && !metrics) {
    return <PanelSkeleton title="Salud operativa: Contabilidad" rows={3} />
  }

  if (!metrics) {
    return (
      <PanelError
        message="No se pudo consultar la salud operativa."
        onRetry={refetch}
      />
    )
  }

  const status = deriveHealthStatus(metrics)
  const StatusIcon = status.Icon

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">Salud operativa: Contabilidad</CardTitle>
        <Badge variant="outline" className={status.className}>
          <StatusIcon className="mr-1 size-3.5" />
          {status.label}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm">Periodo Activo:</span>
          {metrics.hasActivePeriod
            ? <Badge variant="default">{metrics.currentPeriodStatus}</Badge>
            : <Badge variant="destructive">Ninguno</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">Último Cierre:</span>
          <code className="text-sm">{metrics.lastClosedPeriod ?? 'N/A'}</code>
        </div>
        <Metric label="Total Periodos" value={metrics.totalPeriods} />
        {error && <StaleBanner onRetry={refetch} />}
        <div className="flex items-center justify-between pt-1">
          {actualizadoEn && <LastUpdatedLabel date={actualizadoEn} />}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Actualizar datos"
            disabled={isLoading}
            onClick={refetch}
            className="h-7 w-7"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/** @description Presenta una métrica contable. @param {{ label: string; value: string | number }} props @returns {React.JSX.Element} */
function Metric({ label, value }: { label: string; value: string | number }): React.JSX.Element {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold tabular-nums">{value}</p></div>
}
