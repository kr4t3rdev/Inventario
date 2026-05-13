'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Clock,
  AlertCircle,
  FileText,
  User,
} from 'lucide-react'

interface AuditLog {
  id: string
  entidad: string
  entidadId: string
  accion: string
  usuarioId: string
  detalles: Record<string, unknown> | null
  createdAt: string
}

interface LogsResponse {
  logs: AuditLog[]
  total: number
}

const ACTION_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  CREATE: { label: 'Creación', variant: 'default' },
  UPDATE: { label: 'Actualización', variant: 'secondary' },
  DELETE: { label: 'Eliminación', variant: 'destructive' },
}

const ENTIDAD_ICONS: Record<string, React.ReactNode> = {
  TRANSFERENCIA: <FileText className="h-3.5 w-3.5" />,
  TIPO_PAGO: <FileText className="h-3.5 w-3.5" />,
}

/**
 * @description Tabla de logs de auditoría del módulo de contabilidad.
 * Muestra eventos con fecha, entidad, acción y usuario.
 * @returns {JSX.Element} Tabla de auditoría
 */
export function AuditLogsTable() {
  const [data, setData] = useState<LogsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch('/api/contabilidad/logs')

        if (response.status === 403) {
          setError('No tienes permisos de administrador para ver los logs de auditoría.')
          return
        }

        if (!response.ok) throw new Error('Error al cargar logs de auditoría')
        const json: LogsResponse = await response.json()
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setIsLoading(false)
      }
    }

    fetchLogs()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-4 p-6" role="status" aria-label="Cargando logs">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error) {
    const isPermissionError = error.includes('permisos')

    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        {isPermissionError ? (
          <>
            <ShieldX className="h-12 w-12 text-amber-500 mb-4" />
            <h2 className="text-lg font-semibold">Acceso restringido</h2>
            <p className="text-muted-foreground">{error}</p>
          </>
        ) : (
          <>
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-lg font-semibold">Error al cargar auditor&iacute;a</h2>
            <p className="text-muted-foreground">{error}</p>
          </>
        )}
      </div>
    )
  }

  if (!data || data.logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <ShieldCheck className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">Sin registros de auditor&iacute;a</h2>
        <p className="text-muted-foreground">
          No hay eventos registrados en el m&oacute;dulo de contabilidad.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Registro de Auditor&iacute;a
          </h3>
          <p className="text-sm text-muted-foreground">
            Total: {data.total} eventos registrados.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {data.logs.map((log) => {
          const actionConfig = ACTION_LABELS[log.accion] || { label: log.accion, variant: 'outline' as const }

          return (
            <div
              key={log.id}
              className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <div className="mt-0.5 text-muted-foreground">
                {ENTIDAD_ICONS[log.entidad] || <FileText className="h-3.5 w-3.5" />}
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={actionConfig.variant} className="text-xs">
                    {actionConfig.label}
                  </Badge>
                  <span className="text-sm font-medium">{log.entidad}</span>
                  {log.detalles && (
                    <span className="text-xs text-muted-foreground truncate max-w-xs">
                      {JSON.stringify(log.detalles).slice(0, 80)}
                      {JSON.stringify(log.detalles).length > 80 ? '...' : ''}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(log.createdAt).toLocaleString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {log.usuarioId.slice(0, 8)}...
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
