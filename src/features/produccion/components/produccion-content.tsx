'use client'

/**
 * @description Componente de contenido para Producción (Client Component).
 * Maneja las operaciones principales de producción.
 * Los datos iniciales se reciben como props desde el Server Component.
 */
import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Factory, Plus, Search, Package, ClipboardList, CheckCircle, XCircle, Clock, Trash2, Edit } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { 
  getRecetasProduccionAction,
  getOrdenesProduccionAction,
  createRecetaProduccionAction,
  updateRecetaProduccionAction,
  deleteRecetaProduccionAction,
  setIngredientesRecetaProduccionAction,
  createOrdenProduccionAction,
  aprobarOrdenProduccionAction,
  completarOrdenProduccionAction,
  cancelarOrdenProduccionAction,
} from '../actions'

interface RecetaProduccion {
  recetaId: string
  nombre: string
  rendimiento: number
  costoUnitario: number
  producto?: { id: string; nombre: string } | null
  ingredientes: { ingredienteId: string; cantidad: number; unidad: string }[]
}

interface OrdenProduccion {
  ordenProduccionId: string
  cantidad: number
  estado: string
  observaciones: string | null
  fechaProduccion: string
  createdAt: string
  receta?: RecetaProduccion | null
}

interface ProduccionContentProps {
  initialRecetas: RecetaProduccion[]
  initialOrdenes: OrdenProduccion[]
}

const PRODUCTION_STATES = {
  PENDIENTE: 'PENDIENTE',
  APROBADA: 'APROBADA',
  EN_PROCESO: 'EN_PROCESO',
  COMPLETADA: 'COMPLETADA',
  CANCELADA: 'CANCELADA',
}

const PRODUCTION_STATE_LABELS = {
  PENDIENTE: 'Pendiente',
  APROBADA: 'Aprobada',
  EN_PROCESO: 'En Proceso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
}

export function ProduccionContent({ initialRecetas, initialOrdenes }: ProduccionContentProps) {
  const router = useRouter()
  const [recetas, setRecetas] = useState<RecetaProduccion[]>(initialRecetas)
  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>(initialOrdenes)
  const [isLoading, setIsLoading] = useState(false)
  
  // Search states
  const [searchRecetas, setSearchRecetas] = useState('')
  const [filtroEstadoOrden, setFiltroEstadoOrden] = useState('all')

  // Modal states
  const [showRecetaModal, setShowRecetaModal] = useState(false)
  const [showOrdenModal, setShowOrdenModal] = useState(false)
  const [recetaToDelete, setRecetaToDelete] = useState<string | null>(null)
  const [ordenToAction, setOrdenToAction] = useState<{id: string; action: 'aprobar' | 'completar' | 'cancelar'} | null>(null)

  // Form states
  const [nombreReceta, setNombreReceta] = useState('')
  const [rendimiento, setRendimiento] = useState(1)
  const [selectedReceta, setSelectedReceta] = useState('')
  const [cantidadOrden, setCantidadOrden] = useState(1)

  // Filter data
  const filteredRecetas = recetas.filter(r => 
    !searchRecetas || r.nombre.toLowerCase().includes(searchRecetas.toLowerCase())
  )
  
  const filteredOrdenes = ordenes.filter(o => 
    filtroEstadoOrden === 'all' || o.estado === filtroEstadoOrden
  )

  const getEstadoBadge = (estado: string) => {
    switch (String(estado).toUpperCase()) {
      case PRODUCTION_STATES.PENDIENTE:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> {PRODUCTION_STATE_LABELS.PENDIENTE}</Badge>
      case PRODUCTION_STATES.APROBADA:
        return <Badge variant="default"><Clock className="w-3 h-3 mr-1" /> {PRODUCTION_STATE_LABELS.APROBADA}</Badge>
      case PRODUCTION_STATES.COMPLETADA:
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> {PRODUCTION_STATE_LABELS.COMPLETADA}</Badge>
      case PRODUCTION_STATES.CANCELADA:
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> {PRODUCTION_STATE_LABELS.CANCELADA}</Badge>
      default:
        return <Badge>{estado}</Badge>
    }
  }

  const handleCreateReceta = async () => {
    if (!nombreReceta.trim()) {
      toast.error('El nombre de la receta es requerido')
      return
    }
    setIsLoading(true)
    try {
      const result = await createRecetaProduccionAction({
        nombre: nombreReceta,
        rendimiento: Number(rendimiento),
      })
      if (result) {
        toast.success('Receta creada exitosamente')
        setShowRecetaModal(false)
        setNombreReceta('')
        setRendimiento(1)
        const ref = await getRecetasProduccionAction({})
        if (ref.success) setRecetas(ref.data?.data ?? [])
      }
    } catch (error) {
      toast.error('Error al crear la receta')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteReceta = async () => {
    if (!recetaToDelete) return
    setIsLoading(true)
    try {
      const result = await deleteRecetaProduccionAction(recetaToDelete)
      if (result.success) {
        toast.success('Receta eliminada')
        setRecetas(recetas.filter(r => r.recetaId !== recetaToDelete))
      }
    } catch (error) {
      toast.error('Error al eliminar')
    } finally {
      setIsLoading(false)
      setRecetaToDelete(null)
    }
  }

  const handleCreateOrden = async () => {
    if (!selectedReceta) {
      toast.error('Seleccione una receta')
      return
    }
    setIsLoading(true)
    try {
      const result = await createOrdenProduccionAction({
        recetaId: selectedReceta,
        cantidad: Number(cantidadOrden),
        fechaProduccion: new Date().toISOString(),
      })
      if (result) {
        toast.success('Orden de producción creada')
        setShowOrdenModal(false)
        setSelectedReceta('')
        setCantidadOrden(1)
        const ref = await getOrdenesProduccionAction({})
        if (ref.success) setOrdenes(ref.data?.data ?? [])
      }
    } catch (error) {
      toast.error('Error al crear la orden')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOrdenAction = async () => {
    if (!ordenToAction) return
    setIsLoading(true)
    try {
      let result
      if (ordenToAction.action === 'aprobar') {
        result = await aprobarOrdenProduccionAction(ordenToAction.id)
      } else if (ordenToAction.action === 'completar') {
        result = await completarOrdenProduccionAction(ordenToAction.id)
      } else if (ordenToAction.action === 'cancelar') {
        result = await cancelarOrdenProduccionAction(ordenToAction.id)
      }
      
      if (result) {
        toast.success(`Orden ${ordenToAction.action === 'aprobar' ? 'aprobada' : ordenToAction.action === 'completar' ? 'completada' : 'cancelada'}`)
        const ref = await getOrdenesProduccionAction({})
        if (ref.success) setOrdenes(ref.data?.data ?? [])
      }
    } catch (error) {
      toast.error('Error al realizar la acción')
    } finally {
      setIsLoading(false)
      setOrdenToAction(null)
    }
  }

  return (
    <div className="container mx-auto py-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-linear-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
          <Factory className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Producción</h1>
          <p className="text-muted-foreground text-sm">Gestiona recetas y órdenes de producción</p>
        </div>
      </div>

      <Tabs defaultValue="recetas" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="recetas">
            <Package className="mr-2 h-4 w-4" />
            Recetas
          </TabsTrigger>
          <TabsTrigger value="ordenes">
            <ClipboardList className="mr-2 h-4 w-4" />
            Órdenes de Producción
          </TabsTrigger>
        </TabsList>

        {/* Recetas Tab */}
        <TabsContent value="recetas">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recetas de Producción</CardTitle>
                <CardDescription>Lista de recetas disponibles</CardDescription>
              </div>
              <Button onClick={() => setShowRecetaModal(true)} className="bg-orange-500 hover:bg-orange-600">
                <Plus className="mr-2 h-4 w-4" />
                Nueva Receta
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar recetas..."
                    value={searchRecetas}
                    onChange={(e) => setSearchRecetas(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Rendimiento</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Ingredientes</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecetas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No hay recetas
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecetas.map((receta) => (
                      <TableRow key={receta.recetaId}>
                        <TableCell className="font-medium">{receta.nombre}</TableCell>
                        <TableCell>{receta.rendimiento}</TableCell>
                        <TableCell>{receta.producto?.nombre || '-'}</TableCell>
                        <TableCell>{receta.ingredientes?.length || 0}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setRecetaToDelete(receta.recetaId)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Órdenes Tab */}
        <TabsContent value="ordenes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Órdenes de Producción</CardTitle>
                <CardDescription>Órdenes de producción activas</CardDescription>
              </div>
              <Button onClick={() => setShowOrdenModal(true)} className="bg-orange-500 hover:bg-orange-600">
                <Plus className="mr-2 h-4 w-4" />
                Nueva Orden
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <Select value={filtroEstadoOrden} onValueChange={setFiltroEstadoOrden}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filtrar por estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                    <SelectItem value="APROBADA">Aprobada</SelectItem>
                    <SelectItem value="COMPLETADA">Completada</SelectItem>
                    <SelectItem value="CANCELADA">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Receta</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrdenes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No hay órdenes
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrdenes.map((orden) => (
                      <TableRow key={orden.ordenProduccionId}>
                        <TableCell>{new Date(orden.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>{orden.receta?.nombre || '-'}</TableCell>
                        <TableCell>{orden.cantidad}</TableCell>
                        <TableCell>{getEstadoBadge(orden.estado)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {orden.estado === 'PENDIENTE' && (
                              <Button size="sm" onClick={() => setOrdenToAction({ id: orden.ordenProduccionId, action: 'aprobar' })}>
                                Aprobar
                              </Button>
                            )}
                            {orden.estado === 'APROBADA' && (
                              <Button size="sm" onClick={() => setOrdenToAction({ id: orden.ordenProduccionId, action: 'completar' })}>
                                Completar
                              </Button>
                            )}
                            {orden.estado !== 'COMPLETADA' && orden.estado !== 'CANCELADA' && (
                              <Button size="sm" variant="destructive" onClick={() => setOrdenToAction({ id: orden.ordenProduccionId, action: 'cancelar' })}>
                                Cancelar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Receta Modal */}
      <Dialog open={showRecetaModal} onOpenChange={setShowRecetaModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Receta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre de la receta</Label>
              <Input value={nombreReceta} onChange={(e) => setNombreReceta(e.target.value)} placeholder="Ej: Pan integral" />
            </div>
            <div>
              <Label>Rendimiento</Label>
              <Input type="number" value={rendimiento} onChange={(e) => setRendimiento(Number(e.target.value))} />
            </div>
            <Button onClick={handleCreateReceta} disabled={isLoading} className="w-full">
              Crear Receta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Orden Modal */}
      <Dialog open={showOrdenModal} onOpenChange={setShowOrdenModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Orden de Producción</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Seleccionar Receta</Label>
              <Select value={selectedReceta} onValueChange={setSelectedReceta}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione una receta" />
                </SelectTrigger>
                <SelectContent>
                  {recetas.map((r) => (
                    <SelectItem key={r.recetaId} value={r.recetaId}>
                      {r.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cantidad a producir</Label>
              <Input type="number" value={cantidadOrden} onChange={(e) => setCantidadOrden(Number(e.target.value))} />
            </div>
            <Button onClick={handleCreateOrden} disabled={isLoading} className="w-full">
              Crear Orden
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Receta Confirmation */}
      <Dialog open={!!recetaToDelete} onOpenChange={() => setRecetaToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar receta?</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <Button onClick={handleDeleteReceta} disabled={isLoading} variant="destructive" className="w-full">
            Eliminar
          </Button>
        </DialogContent>
      </Dialog>

      {/* Orden Action Confirmation */}
      <Dialog open={!!ordenToAction} onOpenChange={() => setOrdenToAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {ordenToAction?.action === 'aprobar' && '¿Aprobar orden?'}
              {ordenToAction?.action === 'completar' && '¿Completar orden?'}
              {ordenToAction?.action === 'cancelar' && '¿Cancelar orden?'}
            </DialogTitle>
          </DialogHeader>
          <Button onClick={handleOrdenAction} disabled={isLoading} className="w-full">
            Confirmar
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}