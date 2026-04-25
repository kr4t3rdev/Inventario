'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGetPeriodosQuery, useAperturarPeriodoMutation, useCerrarDiarioMutation, useCerrarMensualMutation, useCerrarAnualMutation } from '@/lib/redux/services/contabilidadApi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { CalendarDays, Lock, LockOpen, PlusCircle, FolderOpen } from 'lucide-react'

/**
 * @description Panel de acciones rápidas para aperturar y cerrar períodos
 * @returns {JSX.Element} Panel de acciones
 */
export function PeriodoAcciones() {
  const router = useRouter()
  const [fechaApertura, setFechaApertura] = useState(() => new Date().toISOString().split('T')[0])
  const [periodoCierre, setPeriodoCierre] = useState('')
  const [dialogOpen, setDialogOpen] = useState<'apertura' | 'cierre-diario' | 'cierre-mensual' | 'cierre-anual' | null>(null)

  const { refetch } = useGetPeriodosQuery({})
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
      await cerrarDiario({ periodoId: periodoCierre }).unwrap()
      toast.success('Cierre diario procesado')
      refetch()
      setDialogOpen(null)
    } catch (err: any) {
      toast.error(err?.data?.error ?? 'Error al cerrar el período diario')
    }
  }

  const handleCerrarMensual = async () => {
    try {
      await cerrarMensual({ periodoId: periodoCierre }).unwrap()
      toast.success('Cierre mensual procesado')
      refetch()
      setDialogOpen(null)
    } catch (err: any) {
      toast.error(err?.data?.error ?? 'Error al cerrar el período mensual')
    }
  }

  const handleCerrarAnual = async () => {
    try {
      await cerrarAnual({ periodoId: periodoCierre }).unwrap()
      toast.success('Cierre anual procesado')
      refetch()
      setDialogOpen(null)
    } catch (err: any) {
      toast.error(err?.data?.error ?? 'Error al cerrar el período anual')
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                  <Input
                    id="fecha-apertura"
                    type="date"
                    value={fechaApertura}
                    onChange={(e) => setFechaApertura(e.target.value)}
                  />
                </div>
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
          <Dialog open={dialogOpen === 'cierre-diario'} onOpenChange={(o) => setDialogOpen(o ? 'cierre-diario' : null)}>
            <DialogTrigger asChild>
              <Button className="w-full" size="sm" variant="secondary">
                <Lock className="h-4 w-4 mr-1" />
                Cerrar Día
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cierre Diario</DialogTitle>
                <DialogDescription>Ingrese el ID del período diario que desea cerrar</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="periodo-cierre">ID del Período</Label>
                  <Input
                    id="periodo-cierre"
                    placeholder="periodoId"
                    value={periodoCierre}
                    onChange={(e) => setPeriodoCierre(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(null)}>Cancelar</Button>
                <Button onClick={handleCerrarDiario} disabled={isCerrandoDiario || !periodoCierre}>
                  {isCerrandoDiario ? 'Cerrando...' : 'Confirmar Cierre'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
          <Dialog open={dialogOpen === 'cierre-mensual'} onOpenChange={(o) => setDialogOpen(o ? 'cierre-mensual' : null)}>
            <DialogTrigger asChild>
              <Button className="w-full" size="sm" variant="secondary">
                <CalendarDays className="h-4 w-4 mr-1" />
                Cerrar Mes
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cierre Mensual</DialogTitle>
                <DialogDescription>Ingrese el ID del período mensual que desea cerrar</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="periodo-mensual">ID del Período Mensual</Label>
                  <Input
                    id="periodo-mensual"
                    placeholder="periodoId"
                    value={periodoCierre}
                    onChange={(e) => setPeriodoCierre(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(null)}>Cancelar</Button>
                <Button onClick={handleCerrarMensual} disabled={isCerrandoMensual || !periodoCierre}>
                  {isCerrandoMensual ? 'Cerrando...' : 'Confirmar Cierre'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
          <Dialog open={dialogOpen === 'cierre-anual'} onOpenChange={(o) => setDialogOpen(o ? 'cierre-anual' : null)}>
            <DialogTrigger asChild>
              <Button className="w-full" size="sm" variant="secondary">
                <LockOpen className="h-4 w-4 mr-1" />
                Cerrar Año
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cierre Anual</DialogTitle>
                <DialogDescription>Ingrese el ID del período anual que desea cerrar</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="periodo-anual">ID del Período Anual</Label>
                  <Input
                    id="periodo-anual"
                    placeholder="periodoId"
                    value={periodoCierre}
                    onChange={(e) => setPeriodoCierre(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(null)}>Cancelar</Button>
                <Button onClick={handleCerrarAnual} disabled={isCerrandoAnual || !periodoCierre}>
                  {isCerrandoAnual ? 'Cerrando...' : 'Confirmar Cierre'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  )
}