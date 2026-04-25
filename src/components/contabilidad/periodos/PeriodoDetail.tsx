'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGetPeriodoQuery, useAprobarPeriodoMutation, useReabrirPeriodoMutation } from '@/lib/redux/services/contabilidadApi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle, RotateCcw, AlertTriangle, FileText } from 'lucide-react'

const ESTADO_CONFIG: Record<string, { label: string; className: string }> = {
  BORRADOR: { label: 'Borrador', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  ABIERTO: { label: 'Abierto', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  EN_CIERRE: { label: 'En Cierre', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  CERRADO: { label: 'Cerrado', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  APROBADO: { label: 'Aprobado', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  REABIERTO: { label: 'Reabierto', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
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

  const { data: periodo, isLoading, isError } = useGetPeriodoQuery(periodoId)
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
  const puedeAprobar = ['CERRADO'].includes(periodo.estado)
  const puedeReabrir = ['CERRADO', 'APROBADO'].includes(periodo.estado)

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

      {(periodo.puedeOperar || periodo.puedeCerrar || periodo.puedeAprobar || periodo.puedeReabrir) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Acciones Disponibles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {periodo.puedeOperar && <Badge variant="outline">Operar</Badge>}
              {periodo.puedeCerrar && <Badge variant="outline">Cerrar</Badge>}
              {periodo.puedeAprobar && <Badge variant="outline">Aprobar</Badge>}
              {periodo.puedeReabrir && <Badge variant="outline">Reabrir</Badge>}
            </div>
          </CardContent>
        </Card>
      )}

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
    </div>
  )
}