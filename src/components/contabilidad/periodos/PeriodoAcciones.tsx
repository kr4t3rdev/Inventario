'use client'

import { useState, useMemo } from 'react'
import { useGetPeriodosQuery, useGetPrecierreQuery, useAperturarPeriodoMutation, useCerrarDiarioMutation, useCerrarMensualMutation, useCerrarAnualMutation } from '@/lib/redux/services/contabilidadApi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { CalendarDays, Lock, LockOpen, PlusCircle, FolderOpen, AlertTriangle, Loader2, Eye } from 'lucide-react'

const ESTADO_NAMES: Record<string, string> = {
  BORRADOR: 'Borrador', ABIERTO: 'Abierto', EN_CIERRE: 'En Cierre',
  CERRADO: 'Cerrado', APROBADO: 'Aprobado', REABIERTO: 'Reabierto',
}

function buildPeriodCode(tipo: string, fecha: string): string {
  const d = new Date(fecha + 'T00:00:00')
  if (tipo === 'DIARIO') return `D-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  if (tipo === 'MENSUAL') return `M-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  if (tipo === 'ANUAL') return `Y-${d.getFullYear()}`
  return ''
}

function BlockerPreview({ blockers }: { blockers: string[] | undefined }) {
  if (!blockers || blockers.length === 0) return null
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 space-y-1">
      <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        Bloqueadores ({blockers.length})
      </p>
      <ul className="list-disc list-inside space-y-0.5">
        {blockers.map((b, i) => (
          <li key={i} className="text-xs text-amber-600 dark:text-amber-300">{b}</li>
        ))}
      </ul>
    </div>
  )
}

function PeriodStatusPreview({ periodo }: { periodo: any | null }) {
  if (!periodo) return null
  return (
    <div className="text-xs text-muted-foreground space-y-1 p-2 rounded bg-muted/50">
      <p>Período: <span className="font-mono font-medium">{periodo.codigo}</span></p>
      <p>Estado: <Badge variant="outline" className="text-xs ml-1">{ESTADO_NAMES[periodo.estado] ?? periodo.estado}</Badge></p>
      {periodo.fechaInicio && (
        <p>Inicio: {new Date(periodo.fechaInicio).toLocaleDateString('es-ES')}</p>
      )}
    </div>
  )
}

/**
 * @description Panel de acciones rápidas para aperturar y cerrar períodos
 * @returns {JSX.Element} Panel de acciones
 */
export function PeriodoAcciones() {
  const [fechaApertura, setFechaApertura] = useState(() => new Date().toISOString().split('T')[0])
  const [fechaCierreDiario, setFechaCierreDiario] = useState(() => new Date().toISOString().split('T')[0])
  const [fechaCierreMensual, setFechaCierreMensual] = useState(() => new Date().toISOString().split('T')[0])
  const [fechaCierreAnual, setFechaCierreAnual] = useState(() => new Date().toISOString().split('T')[0])
  const [fechaPrecierre, setFechaPrecierre] = useState(() => new Date().toISOString().split('T')[0])
  const [dialogOpen, setDialogOpen] = useState<'apertura' | 'cierre-diario' | 'cierre-mensual' | 'cierre-anual' | 'precierre' | null>(null)

  const { refetch, data: periodosData } = useGetPeriodosQuery({})
  const periodos: any[] = periodosData?.items ?? periodosData?.periodos ?? []

  const codigoCierreDiario = useMemo(() => buildPeriodCode('DIARIO', fechaCierreDiario), [fechaCierreDiario])
  const codigoCierreMensual = useMemo(() => buildPeriodCode('MENSUAL', fechaCierreMensual), [fechaCierreMensual])
  const codigoCierreAnual = useMemo(() => buildPeriodCode('ANUAL', fechaCierreAnual), [fechaCierreAnual])
  const codigoPrecierre = useMemo(() => buildPeriodCode('DIARIO', fechaPrecierre), [fechaPrecierre])

  const periodoDestinoDiario = useMemo(() => periodos.find((p: any) => p.codigo === codigoCierreDiario), [periodos, codigoCierreDiario])
  const periodoDestinoMensual = useMemo(() => periodos.find((p: any) => p.codigo === codigoCierreMensual), [periodos, codigoCierreMensual])
  const periodoDestinoAnual = useMemo(() => periodos.find((p: any) => p.codigo === codigoCierreAnual), [periodos, codigoCierreAnual])
  const periodoPrecierre = useMemo(() => periodos.find((p: any) => p.codigo === codigoPrecierre), [periodos, codigoPrecierre])

  const { data: precierreData, isLoading: isLoadingPrecierre } = useGetPrecierreQuery(
    { fecha: fechaPrecierre },
    { skip: dialogOpen !== 'precierre' }
  )

  const [aperturar, { isLoading: isAperturando }] = useAperturarPeriodoMutation()
  const [cerrarDiario, { isLoading: isCerrandoDiario }] = useCerrarDiarioMutation()
  const [cerrarMensual, { isLoading: isCerrandoMensual }] = useCerrarMensualMutation()
  const [cerrarAnual, { isLoading: isCerrandoAnual }] = useCerrarAnualMutation()

  const handleAperturar = async () => {
    try {
      await aperturar({ fecha: fechaApertura }).unwrap()
      toast.success('Período diario abierto exitosamente')
      refetch()
      setDialogOpen(null)
    } catch (err: any) {
      toast.error(err?.data?.error ?? 'Error al abrir el período')
    }
  }

  const handleCerrarDiario = async () => {
    try {
      await cerrarDiario({ fecha: fechaCierreDiario }).unwrap()
      toast.success('Cierre diario procesado')
      refetch()
      setDialogOpen(null)
    } catch (err: any) {
      toast.error(err?.data?.error ?? 'Error al cerrar el período diario')
    }
  }

  const handleCerrarMensual = async () => {
    try {
      await cerrarMensual({ fecha: fechaCierreMensual }).unwrap()
      toast.success('Cierre mensual procesado')
      refetch()
      setDialogOpen(null)
    } catch (err: any) {
      toast.error(err?.data?.error ?? 'Error al cerrar el período mensual')
    }
  }

  const handleCerrarAnual = async () => {
    try {
      await cerrarAnual({ fecha: fechaCierreAnual }).unwrap()
      toast.success('Cierre anual procesado')
      refetch()
      setDialogOpen(null)
    } catch (err: any) {
      toast.error(err?.data?.error ?? 'Error al cerrar el período anual')
    }
  }

  const renderCloseDialog = (
    tipo: 'cierre-diario' | 'cierre-mensual' | 'cierre-anual',
    titulo: string,
    descripcion: string,
    fecha: string,
    setFecha: (v: string) => void,
    periodoDestino: any,
    onConfirm: () => void,
    isClosing: boolean,
  ) => (
    <Dialog open={dialogOpen === tipo} onOpenChange={(o) => setDialogOpen(o ? tipo : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor={`fecha-${tipo}`}>Fecha</Label>
            <Input id={`fecha-${tipo}`} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          {periodoDestino && (
            <>
              <PeriodStatusPreview periodo={periodoDestino} />
              <BlockerPreview blockers={periodoDestino.blockers} />
            </>
          )}
          {!periodoDestino && (
            <p className="text-xs text-amber-600">No se encontró un período {tipo === 'cierre-diario' ? 'diario' : tipo === 'cierre-mensual' ? 'mensual' : 'anual'} para esta fecha. Debe aperturarlo primero.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(null)}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={isClosing || !fecha || !periodoDestino}>
            {isClosing ? 'Cerrando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="border-emerald-200 dark:border-emerald-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-emerald-600" />
              Apertura Diaria
            </CardTitle>
            <CardDescription className="text-xs">Abrir un nuevo día contable</CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={dialogOpen === 'apertura'} onOpenChange={(o) => setDialogOpen(o ? 'apertura' : null)}>
              <DialogTrigger asChild>
                <Button className="w-full" size="sm">
                  <PlusCircle className="h-4 w-4 mr-1" />
                  Abrir Día
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Abrir Período Diario</DialogTitle>
                  <DialogDescription>Seleccione la fecha del período que desea abrir</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="fecha-apertura">Fecha</Label>
                    <Input id="fecha-apertura" type="date" value={fechaApertura} onChange={(e) => setFechaApertura(e.target.value)} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Se creará el período <span className="font-mono font-medium">{buildPeriodCode('DIARIO', fechaApertura)}</span>
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(null)}>Cancelar</Button>
                  <Button onClick={handleAperturar} disabled={isAperturando}>
                    {isAperturando ? 'Abriendo...' : 'Confirmar Apertura'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card className="border-amber-200 dark:border-amber-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-600" />
              Cierre Diario
            </CardTitle>
            <CardDescription className="text-xs">Cerrar el día y generar snapshot</CardDescription>
          </CardHeader>
          <CardContent>
            {renderCloseDialog('cierre-diario', 'Cierre Diario', 'Seleccione la fecha del día contable que desea cerrar', fechaCierreDiario, setFechaCierreDiario, periodoDestinoDiario, handleCerrarDiario, isCerrandoDiario)}
          </CardContent>
        </Card>

        <Card className="border-blue-200 dark:border-blue-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-blue-600" />
              Cierre Mensual
            </CardTitle>
            <CardDescription className="text-xs">Consolidar mes y cerrar</CardDescription>
          </CardHeader>
          <CardContent>
            {renderCloseDialog('cierre-mensual', 'Cierre Mensual', 'Seleccione una fecha dentro del mes que desea cerrar', fechaCierreMensual, setFechaCierreMensual, periodoDestinoMensual, handleCerrarMensual, isCerrandoMensual)}
          </CardContent>
        </Card>

        <Card className="border-purple-200 dark:border-purple-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <LockOpen className="h-4 w-4 text-purple-600" />
              Cierre Anual
            </CardTitle>
            <CardDescription className="text-xs">Consolidar ejercicio anual</CardDescription>
          </CardHeader>
          <CardContent>
            {renderCloseDialog('cierre-anual', 'Cierre Anual', 'Seleccione una fecha dentro del año que desea cerrar', fechaCierreAnual, setFechaCierreAnual, periodoDestinoAnual, handleCerrarAnual, isCerrandoAnual)}
          </CardContent>
        </Card>

        <Card className="border-sky-200 dark:border-sky-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4 text-sky-600" />
              Precierre
            </CardTitle>
            <CardDescription className="text-xs">Validar antes de cerrar</CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={dialogOpen === 'precierre'} onOpenChange={(o) => setDialogOpen(o ? 'precierre' : null)}>
              <DialogTrigger asChild>
                <Button className="w-full" size="sm" variant="outline">
                  <Eye className="h-4 w-4 mr-1" />
                  Validar Día
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Pre-cierre</DialogTitle>
                  <DialogDescription>Valide el estado del período antes de cerrar</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="fecha-precierre">Fecha</Label>
                    <Input id="fecha-precierre" type="date" value={fechaPrecierre} onChange={(e) => setFechaPrecierre(e.target.value)} />
                  </div>
                  {periodoPrecierre && <PeriodStatusPreview periodo={periodoPrecierre} />}
                  {isLoadingPrecierre && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Validando período...
                    </div>
                  )}
                  {precierreData && (
                    <div className="space-y-2">
                      {precierreData.blockers?.length > 0 && <BlockerPreview blockers={precierreData.blockers} />}
                      {precierreData.snapshot && (
                        <div className="rounded-md border bg-muted/30 p-3">
                          <p className="text-xs font-medium mb-1">Resumen del snapshot</p>
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                            {JSON.stringify(precierreData.snapshot.resumenJson ?? precierreData.snapshot, null, 2)}
                          </pre>
                        </div>
                      )}
                      {(!precierreData.blockers || precierreData.blockers.length === 0) && (
                        <p className="text-xs text-emerald-600 font-medium">✓ Sin bloqueadores. Listo para cerrar.</p>
                      )}
                    </div>
                  )}
                  {!periodoPrecierre && !isLoadingPrecierre && !precierreData && (
                    <p className="text-xs text-amber-600">No se encontró un período diario para esta fecha.</p>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(null)}>Cerrar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}