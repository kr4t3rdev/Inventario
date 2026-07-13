'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getMastersHealthAction,
  type MastersHealthMetrics,
} from '../actions-health'

interface MastersHealthCardProps {
  userRole?: string
}

interface HealthStatus {
  className: string
  icon: typeof AlertCircle
  label: string
}

/**
 * @description Resuelve el estado operativo según la configuración de datos maestros del tenant.
 * @param {MastersHealthMetrics} metrics - Conteos de datos maestros del tenant.
 * @returns {HealthStatus} Estado visual correspondiente a los conteos.
 */
function getHealthStatus(metrics: MastersHealthMetrics): HealthStatus {
  if (metrics.categorias === 0 || metrics.unidades === 0) {
    return { className: 'text-destructive', icon: AlertCircle, label: 'Crítico' }
  }

  if (metrics.productos < 10) {
    return { className: 'text-amber-600', icon: Info, label: 'Bajo' }
  }

  return { className: 'text-emerald-600', icon: CheckCircle2, label: 'Saludable' }
}

/**
 * @description Muestra a un administrador la salud de los datos maestros de su tenant.
 * @param {MastersHealthCardProps} props - Rol del usuario autenticado.
 * @returns {React.JSX.Element | null} Card de salud o null para roles sin permiso.
 */
export function MastersHealthCard({ userRole }: MastersHealthCardProps): React.JSX.Element | null {
  const [metrics, setMetrics] = useState<MastersHealthMetrics | null>(null)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (userRole !== 'admin') return

    async function loadHealth(): Promise<void> {
      try {
        const result = await getMastersHealthAction()

        if (!result.success || !result.data) {
          setHasError(true)
          toast.error('Error cargando datos de salud')
          return
        }

        setMetrics(result.data.metrics)
      } catch (error) {
        console.error('Error cargando salud de datos maestros:', error)
        setHasError(true)
        toast.error('Error cargando datos de salud')
      }
    }

    void loadHealth()
  }, [userRole])

  if (userRole !== 'admin') return null

  if (hasError) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          No se pudieron cargar las métricas de datos maestros.
        </CardContent>
      </Card>
    )
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="flex justify-center py-6">
          <Loader2 aria-label="Cargando salud de datos maestros" className="size-5 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  const status = getHealthStatus(metrics)
  const StatusIcon = status.icon
  const items = [
    ['Productos', metrics.productos],
    ['Categorías', metrics.categorias],
    ['Unidades', metrics.unidades],
    ['Proveedores', metrics.proveedores],
    ['Ptos Venta', metrics.puntosDeVenta],
    ['Listas Precio', metrics.listasPrecio],
  ] as const

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">Salud operativa: Datos Maestros</CardTitle>
        <Badge variant="outline" className={status.className}>
          <StatusIcon className="mr-1 size-3.5" aria-hidden="true" />
          {status.label}
        </Badge>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {items.map(([label, value]) => (
            <div key={label} className="space-y-1">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
