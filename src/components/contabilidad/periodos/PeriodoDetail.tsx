'use client'

import { useState } from 'react'
import { useGetPeriodoQuery, useGetPeriodoSnapshotQuery, useAprobarPeriodoMutation, useReabrirPeriodoMutation } from '@/lib/redux/services/contabilidadApi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle, RotateCcw, AlertTriangle, FileText, ChevronDown, ChevronRight, Eye } from 'lucide-react'

const ESTADO_CONFIG: Record<string, { label: string; className: string }> = {
  BORRADOR: { label: 'Borrador', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  ABIERTO: { label: 'Abierto', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  EN_CIERRE: { label: 'En Cierre', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  CERRADO: { label: 'Cerrado', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  APROBADO: { label: 'Aprobado', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  REABIERTO: { label: 'Reabierto', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
}

function formatAmount(value: unknown) {
  const amount = Number(value ?? 0)
  return new Intl.NumberFormat('es-CU', {
    style: 'currency',
    currency: 'CUP',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount / 100 : 0)
}

function getLatestSnapshot(periodo: any) {
  return Array.isArray(periodo.snapshots) && periodo.snapshots.length > 0
    ? periodo.snapshots[0]
    : null
}

function getInconsistencias(snapshot: any): string[] {
  return Array.isArray(snapshot?.inconsistenciasJson)
    ? snapshot.inconsistenciasJson.map(String)
    : typeof snapshot?.inconsistenciasJson === 'object' && snapshot?.inconsistenciasJson
      ? Object.entries(snapshot.inconsistenciasJson).map(([k, v]) => `${k}: ${v}`)
      : []
}

const ACCION_CONFIG: Record<string, { label: string; color: string }> = {
  APERTURA: { label: 'Apertura', color: 'bg-emerald-500' },
  CIERRE_DIARIO: { label: 'Cierre Diario', color: 'bg-blue-500' },
  CIERRE_MENSUAL: { label: 'Cierre Mensual', color: 'bg-indigo-500' },
  CIERRE_ANUAL: { label: 'Cierre Anual', color: 'bg-violet-500' },
  APROBACION: { label: 'Aprobación', color: 'bg-purple-500' },
  REAPERTURA: { label: 'Reapertura', color: 'bg-orange-500' },
}

/**
 * @description Vista de detalle de un período contable con acciones de aprobación y reapertura
 * @param {Object} props - Props del componente
 * @param {string} props.periodoId - ID del período a mostrar
 * @param {Function} props.onBack - Callback para volver a la lista
 * @returns {JSX.Element} Detalle del período
 */
export function PeriodoDetail({ periodoId, onBack }: { periodoId: string; onBack: () => void }) {
  const [motivoReabrir, setMotivoReabrir] = useState('')
  const [dialogOpen, setDialogOpen] = useState<'aprobar' | 'reabrir' | null>(null)
  const [snapshotExpandido, setSnapshotExpandido] = useState(false)
  const [verSnapshotCompleto, setVerSnapshotCompleto] = useState(false)

  const { data: periodo, isLoading, isError } = useGetPeriodoQuery(periodoId)
  const { data: snapshotData, isLoading: isLoadingSnapshot } = useGetPeriodoSnapshotQuery(periodoId, { skip: !verSnapshotCompleto })
  const [aprobar, { isLoading: isAprobando }] = useAprobarPeriodoMutation()
  const [reabrir, { isLoading: isReabriendo }] = useReabrirPeriodoMutation()

  const handleAprobar = async () => {
    try {
      await aprobar({ id: periodoId }).unwrap()
      toast.success('Período aprobado exitosamente')
      setDialogOpen(null)
    } catch (err: any) {
      toast.error(err?.data?.error ?? 'Error al aprobar el período')
    }
  }

  const handleReabrir = async () => {
    try {
      await reabrir({ id: periodoId, motivo: motivoReabrir }).unwrap()
      toast.success('Período reabierto exitosamente')
      setDialogOpen(null)
      setMotivoReabrir('')
    } catch (err: any) {
      toast.error(err?.data?.error ?? 'Error al reabrir el período')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (isError || !periodo) {
    return (
      <Card className="border-red-200 dark:border-red-900">
        <CardContent className="flex items-center gap-3 p-6">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <p className="text-red-600 dark:text-red-400">Error al cargar el período</p>
          <Button variant="outline" size="sm" onClick={onBack}>Volver</Button>
        </CardContent>
      </Card>
    )
  }

  const estadoConf = ESTADO_CONFIG[periodo.estado] ?? ESTADO_CONFIG.BORRADOR
  const puedeAprobar = Boolean(periodo.puedeAprobar ?? ['CERRADO'].includes(periodo.estado))
  const puedeReabrir = Boolean(periodo.puedeReabrir ?? ['CERRADO', 'APROBADO'].includes(periodo.estado))
  const snapshotActual = getLatestSnapshot(periodo)
  const resumen = snapshotActual?.resumenJson ?? {}
  const inconsistencias = getInconsistencias(snapshotActual)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
          <div>
            <h2 className="text-2xl font-semibold">{periodo.codigo}</h2>
            <p className="text-muted-foreground text-sm">
              Período {periodo.tipo?.toLowerCase()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={estadoConf.className}>{estadoConf.label}</Badge>
          {puedeAprobar && (
            <Dialog open={dialogOpen === 'aprobar'} onOpenChange={(o) => setDialogOpen(o ? 'aprobar' : null)}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Aprobar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Aprobar Período</DialogTitle>
                  <DialogDescription>¿Confirma la aprobación del período {periodo.codigo}?</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(null)}>Cancelar</Button>
                  <Button onClick={handleAprobar} disabled={isAprobando}>
                    {isAprobando ? 'Aprobando...' : 'Confirmar'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {puedeReabrir && (
            <Dialog open={dialogOpen === 'reabrir'} onOpenChange={(o) => setDialogOpen(o ? 'reabrir' : null)}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reabrir
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reabrir Período</DialogTitle>
                  <DialogDescription>Debe indicar el motivo de la reapertura del período {periodo.codigo}</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="motivo">Motivo (obligatorio)</Label>
                  <Textarea
                    id="motivo"
                    value={motivoReabrir}
                    onChange={(e) => setMotivoReabrir(e.target.value)}
                    placeholder="Describa el motivo de la reapertura..."
                    rows={3}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(null)}>Cancelar</Button>
                  <Button onClick={handleReabrir} disabled={isReabriendo || !motivoReabrir.trim()}>
                    {isReabriendo ? 'Reabriendo...' : 'Confirmar Reapertura'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Fecha Inicio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {new Date(periodo.fechaInicio).toLocaleDateString('es-ES', { dateStyle: 'long' })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Fecha Fin</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {new Date(periodo.fechaFin).toLocaleDateString('es-ES', { dateStyle: 'long' })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Código
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-mono font-semibold">{periodo.codigo}</p>
          </CardContent>
        </Card>
      </div>

      {periodo.blockers && periodo.blockers.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-900">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Bloqueadores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1">
              {periodo.blockers.map((blocker: string, i: number) => (
                <li key={i} className="text-sm text-amber-700 dark:text-amber-300">{blocker}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {periodo.apertura && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Apertura</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Caja inicial</p>
                <p className="font-semibold">{formatAmount(periodo.apertura.saldoCajaInicial)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Banco inicial</p>
                <p className="font-semibold">{formatAmount(periodo.apertura.saldoBancoInicial)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Resultado acumulado inicial</p>
                <p className="font-semibold">{formatAmount(periodo.apertura.saldoResultadoAcumInicial)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {snapshotActual && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Snapshot Actual</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setVerSnapshotCompleto(!verSnapshotCompleto)}>
              <Eye className="h-3.5 w-3.5 mr-1" />
              {verSnapshotCompleto ? 'Ocultar' : 'Ver completo'}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Versión</p>
                <p className="font-semibold">{snapshotActual.version}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Ingresos</p>
                <p className="font-semibold">{formatAmount(resumen.totalIngresos)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Gastos</p>
                <p className="font-semibold">{formatAmount(resumen.totalGastos)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Diferencia</p>
                <p className="font-semibold">{formatAmount(resumen.diferencia)}</p>
              </div>
            </div>

            {inconsistencias.length > 0 && (
              <div>
                <div
                  className="flex items-center gap-2 cursor-pointer mb-2"
                  onClick={() => setSnapshotExpandido(!snapshotExpandido)}
                >
                  {snapshotExpandido ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    Inconsistencias ({inconsistencias.length})
                  </p>
                </div>
                {snapshotExpandido && (
                  <ul className="list-disc list-inside space-y-1 pl-6">
                    {inconsistencias.map((item, index) => (
                      <li key={`${item}-${index}`} className="text-sm text-amber-700 dark:text-amber-300">{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {verSnapshotCompleto && (
              <div>
                {isLoadingSnapshot ? (
                  <p className="text-sm text-muted-foreground">Cargando snapshot completo...</p>
                ) : (
                  <div className="rounded-md bg-muted/30 p-3 max-h-96 overflow-auto">
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                      {JSON.stringify(snapshotData ?? snapshotActual, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {periodo.subperiodos && periodo.subperiodos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Subperíodos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {periodo.subperiodos.map((subperiodo: any) => (
                <Badge key={subperiodo.periodoId} variant="outline">
                  {subperiodo.codigo} · {subperiodo.estado}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {periodo.auditorias && periodo.auditorias.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Línea de Tiempo — Auditoría</CardTitle>
            <CardDescription className="text-xs">
              {periodo.auditorias.length} evento(s) registrado(s) en orden cronológico
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative space-y-0">
              <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-slate-700" />
              {[...(periodo.auditorias as any[])]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((auditoria: any, _idx: number) => {
                  const accionConf = ACCION_CONFIG[auditoria.accion] ?? { label: auditoria.accion, color: 'bg-slate-500' }
                  return (
                    <div key={auditoria.auditoriaId} className="relative flex gap-4 pb-4 last:pb-0">
                      <div className={`relative z-10 mt-1 h-7 w-7 rounded-full ${accionConf.color} flex items-center justify-center`}>
                        <span className="text-[10px] font-bold text-white">
                          {accionConf.label.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{accionConf.label}</p>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {new Date(auditoria.createdAt).toLocaleString('es-ES', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {auditoria.motivo && (
                          <p className="text-xs text-muted-foreground mt-0.5">{auditoria.motivo}</p>
                        )}
                        {auditoria.usuarioId && (
                          <p className="text-xs text-muted-foreground">por {auditoria.usuarioId}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}