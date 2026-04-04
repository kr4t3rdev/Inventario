'use client'
// @ts-nocheck - Deshabilitar verificación de tipos para este archivo debido a problemas con RTK Query

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { OrdenProduccion, RecetaProduccion, ValeSalida, Producto } from '@/app/models/model'
import { 
  Factory, 
  Plus, 
  Search, 
  Package, 
  ClipboardList, 
  FileText,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Edit,
  Eye
} from 'lucide-react'
import { format } from 'date-fns'
import { 
  useGetRecetasProduccionQuery, 
  useGetOrdenesProduccionQuery, 
  useGetValesSalidaQuery,
  useGetConceptosQuery,
  useCreateRecetaProduccionMutation,
  useSetIngredientesRecetaProduccionMutation,
  useCreateOrdenProduccionMutation,
  useAprobarOrdenProduccionMutation,
  useCompletarOrdenProduccionMutation,
  useCancelarOrdenProduccionMutation,
  useCreateValeSalidaMutation,
  useDeleteRecetaProduccionMutation,
  useUpdateRecetaProduccionMutation
} from '@/lib/redux/services/produccionApi'
import { useGetProductosQuery } from '@/lib/redux/services/productosApi'
import { useGetGastosDEQuery } from '@/lib/redux/services/gastosDEApi'

/**
 * @description Página principal del módulo de Producción.
 * @returns {JSX.Element} Componente de página de producción.
 */
export default function ProduccionPage() {
  const [searchRecetas, setSearchRecetas] = useState('')
  const [searchOrdenes, setSearchOrdenes] = useState('')
  const [searchVales, setSearchVales] = useState('')
  const [filtroEstadoOrden, setFiltroEstadoOrden] = useState<string>('all')
  const [filtroConceptoVale, setFiltroConceptoVale] = useState<string>('all')
  
  // Dialog states
  const [dialogRecetaOpen, setDialogRecetaOpen] = useState(false)
  const [dialogOrdenOpen, setDialogOrdenOpen] = useState(false)
  const [dialogValeOpen, setDialogValeOpen] = useState(false)
  const [confirmacion, setConfirmacion] = useState<{ tipo: 'aprobar' | 'completar' | 'cancelar'; ordenId: string; recetaNombre: string; cantidad: number } | null>(null)
  const [recetaVer, setRecetaVer] = useState<any | null>(null)
  const [recetaEliminar, setRecetaEliminar] = useState<{ recetaId: string; nombre: string } | null>(null)
  const [recetaEdit, setRecetaEdit] = useState<any | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editRendimiento, setEditRendimiento] = useState(1)
  const [editProductoId, setEditProductoId] = useState('')
  const [editItems, setEditItems] = useState<Array<{ productoId: string; cantidad: number; desperdicio: number }>>([])

  // Data
  const { data: recetasTyped, isLoading: loadingRecetas } = useGetRecetasProduccionQuery(searchRecetas ? { search: searchRecetas } : undefined)
  const { data: ordenesTyped, isLoading: loadingOrdenes } = useGetOrdenesProduccionQuery(filtroEstadoOrden !== 'all' ? { estado: filtroEstadoOrden } : undefined)
  const { data: valesTyped, isLoading: loadingVales } = useGetValesSalidaQuery(filtroConceptoVale !== 'all' ? { concepto: filtroConceptoVale } : undefined)
  const { data: conceptos } = useGetConceptosQuery()
  const { data: productosTyped } = useGetProductosQuery()
  const { data: gastosDE } = useGetGastosDEQuery()

  // Mutations
  const [createReceta] = useCreateRecetaProduccionMutation()
  const [setIngredientes] = useSetIngredientesRecetaProduccionMutation()
  const [createOrden] = useCreateOrdenProduccionMutation()
  const [aprobarOrden] = useAprobarOrdenProduccionMutation()
  const [completarOrden] = useCompletarOrdenProduccionMutation()
  const [cancelarOrden] = useCancelarOrdenProduccionMutation()
  const [createVale] = useCreateValeSalidaMutation()
  const [deleteReceta] = useDeleteRecetaProduccionMutation()
  const [updateReceta] = useUpdateRecetaProduccionMutation()

  // Form states
  const [nombreReceta, setNombreReceta] = useState('')
  const [rendimiento, setRendimiento] = useState(1)
  const [selectedProducto, setSelectedProducto] = useState('')
  const [selectedReceta, setSelectedReceta] = useState('')
  const [cantidadOrden, setCantidadOrden] = useState(1)
  const [selectedConcepto, setSelectedConcepto] = useState('')
  const [valeItems, setValeItems] = useState<Array<{ productoId: string; cantidad: number }>>([])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'CUP',
    }).format(amount)
  }

  const getEstadoBadge = (estado: string) => {
    switch (String(estado).toUpperCase()) {
      case 'PENDIENTE':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pendiente</Badge>
      case 'EN_PROCESO':
        return <Badge variant="default"><Clock className="w-3 h-3 mr-1" /> En Proceso</Badge>
      case 'COMPLETADA':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Completada</Badge>
      case 'CANCELADA':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Cancelada</Badge>
      default:
        return <Badge>{estado}</Badge>
    }
  }

  const handleCrearReceta = async () => {
    if (!nombreReceta) return
    
    try {
      const result = await createReceta({
        nombre: nombreReceta,
        rendimiento,
        productoId: selectedProducto || undefined
      }).unwrap()
      
      setDialogRecetaOpen(false)
      setNombreReceta('')
      setRendimiento(1)
      setSelectedProducto('')
    } catch (error) {
      console.error('Error al crear receta:', error)
    }
  }

  const handleCrearOrden = async () => {
    if (!selectedReceta || cantidadOrden < 1) return
    
    try {
      await createOrden({
        recetaId: selectedReceta,
        cantidad: cantidadOrden
      }).unwrap()
      
      setDialogOrdenOpen(false)
      setSelectedReceta('')
      setCantidadOrden(1)
    } catch (error) {
      console.error('Error al crear orden:', error)
    }
  }

  const handleCrearVale = async () => {
    if (!selectedConcepto || valeItems.length === 0) return
    
    try {
      await createVale({
        concepto: selectedConcepto,
        items: valeItems
      }).unwrap()
      
      setDialogValeOpen(false)
      setSelectedConcepto('')
      setValeItems([])
    } catch (error) {
      console.error('Error al crear vale:', error)
    }
  }

  const handleAprobarOrden = async (ordenId: string) => {
    try {
      await aprobarOrden({ ordenProduccionId: ordenId }).unwrap()
    } catch (error) {
      console.error('Error al aprobar orden:', error)
    }
  }

  const handleCompletarOrden = async (ordenId: string) => {
    try {
      await completarOrden({ ordenProduccionId: ordenId }).unwrap()
    } catch (error) {
      console.error('Error al completar orden:', error)
    }
  }

  const handleCancelarOrden = async (ordenId: string) => {
    try {
      await cancelarOrden({ ordenProduccionId: ordenId, observaciones: 'Cancelado por usuario' }).unwrap()
    } catch (error) {
      console.error('Error al cancelar orden:', error)
    }
  }

  const handleGuardarEdicion = async () => {
    if (!editNombre || !recetaEdit) return
    try {
      await updateReceta({
        recetaId: recetaEdit.recetaId,
        payload: {
          nombre: editNombre,
          rendimiento: editRendimiento,
          productoId: editProductoId || undefined,
        },
      }).unwrap()
      await setIngredientes({
        recetaId: recetaEdit.recetaId,
        ingredientes: editItems,
      }).unwrap()
      setRecetaEdit(null)
    } catch (error) {
      console.error('Error al guardar receta:', error)
    }
  }

  const agregarItemVale = (productoId: string) => {
    if (valeItems.find(i => i.productoId === productoId)) return
    setValeItems([...valeItems, { productoId, cantidad: 1 }])
  }

  const actualizarCantidadVale = (productoId: string, cantidad: number) => {
    setValeItems(valeItems.map(i => 
      i.productoId === productoId ? { ...i, cantidad } : i
    ))
  }

  const eliminarItemVale = (productoId: string) => {
    setValeItems(valeItems.filter(i => i.productoId !== productoId))
  }

  // Stats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ordenesPendientes = ordenesTyped?.filter((o: any) => String(o.estado) === 'PENDIENTE').length || 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ordenesEnProceso = ordenesTyped?.filter((o: any) => String(o.estado) === 'EN_PROCESO').length || 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ordenesCompletadas = ordenesTyped?.filter((o: any) => String(o.estado) === 'COMPLETADA').length || 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Factory className="h-8 w-8" />
          <h1 className="text-2xl font-bold">Producción</h1>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recetas</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recetasTyped?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Órdenes Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ordenesPendientes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Proceso</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ordenesEnProceso}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ordenesCompletadas}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="recetasTyped" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recetasTyped">Recetas</TabsTrigger>
          <TabsTrigger value="ordenesTyped">Órdenes de Producción</TabsTrigger>
          <TabsTrigger value="valesTyped">Vales de Salida</TabsTrigger>
        </TabsList>

        {/* Recetas Tab */}
        <TabsContent value="recetasTyped">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recetas de Producción</CardTitle>
                  <CardDescription>Gestiona las recetasTyped para producir productosTyped</CardDescription>
                </div>
                <Dialog open={dialogRecetaOpen} onOpenChange={setDialogRecetaOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Nueva Receta
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nueva Receta de Producción</DialogTitle>
                      <DialogDescription>
                        Define una receta para producir productosTyped del inventario
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="nombre">Nombre de la Receta</Label>
                        <Input 
                          id="nombre" 
                          value={nombreReceta}
                          onChange={(e) => setNombreReceta(e.target.value)}
                          placeholder="Ej: Refresco Instantáneo 1L" 
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="rendimiento">Rendimiento (unidades)</Label>
                        <Input 
                          id="rendimiento" 
                          type="number"
                          min={1}
                          value={rendimiento}
                          onChange={(e) => setRendimiento(parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="producto">Producto del Inventario (opcional)</Label>
                        <Select value={selectedProducto} onValueChange={setSelectedProducto}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar producto" />
                          </SelectTrigger>
                          <SelectContent>
                            {productosTyped?.map((producto) => (
                              <SelectItem key={producto.id} value={producto.id}>
                                {producto.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setDialogRecetaOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleCrearReceta}>
                        Crear Receta
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar recetasTyped..." 
                    value={searchRecetas}
                    onChange={(e) => setSearchRecetas(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Rendimiento</TableHead>
                      <TableHead>Producto Asociado</TableHead>
                      <TableHead>Ingredientes</TableHead>
                      <TableHead>Costo Unitario</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingRecetas ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center">Cargando...</TableCell>
                      </TableRow>
                    ) : recetasTyped?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center">No hay recetas</TableCell>
                      </TableRow>
                    ) : (
                      recetasTyped?.map((receta: any) => (
                        <TableRow key={receta.recetaId}>
                          <TableCell className="font-medium">{receta.nombre}</TableCell>
                          <TableCell>{receta.rendimiento}</TableCell>
                          <TableCell>{receta.producto?.nombre || '-'}</TableCell>
                          <TableCell>{receta.ingredientes?.length || 0}</TableCell>
                          <TableCell>{formatCurrency(receta.costoUnitario)}</TableCell>
                          <TableCell>{format(new Date(receta.createdAt), 'dd/MM/yyyy')}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setRecetaVer(receta)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setRecetaEdit(receta)
                                  setEditNombre(receta.nombre)
                                  setEditRendimiento(receta.rendimiento)
                                  setEditProductoId(receta.producto?.id || '')
                                  setEditItems(receta.ingredientes?.map((i: any) => ({ productoId: i.productoId, cantidad: i.cantidad, desperdicio: i.desperdicio ?? 0 })) || [])
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => setRecetaEliminar({ recetaId: receta.recetaId, nombre: receta.nombre })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Órdenes Tab */}
        <TabsContent value="ordenesTyped">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Órdenes de Producción</CardTitle>
                  <CardDescription>Gestiona las órdenes de producción</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={filtroEstadoOrden} onValueChange={setFiltroEstadoOrden}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Todos los estados" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="en_proceso">En Proceso</SelectItem>
                      <SelectItem value="completada">Completada</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                  <Dialog open={dialogOrdenOpen} onOpenChange={setDialogOrdenOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Nueva Orden
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Nueva Orden de Producción</DialogTitle>
                        <DialogDescription>
                          Crea una orden de producción basada en una receta
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="receta">Receta</Label>
                          <Select value={selectedReceta} onValueChange={setSelectedReceta}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar receta" />
                            </SelectTrigger>
                            <SelectContent>
                              {recetasTyped?.map((receta: any) => (
                                <SelectItem key={receta.recetaId} value={receta.recetaId}>
                                  {receta.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="cantidad">Cantidad a Producir</Label>
                          <Input 
                            id="cantidad" 
                            type="number"
                            min={1}
                            value={cantidadOrden}
                            onChange={(e) => setCantidadOrden(parseInt(e.target.value) || 1)}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setDialogOrdenOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleCrearOrden}>
                          Crear Orden
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receta</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Costo Materiales</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingOrdenes ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">Cargando...</TableCell>
                      </TableRow>
                    ) : ordenesTyped?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">No hay órdenes</TableCell>
                      </TableRow>
                    ) : (
                        ordenesTyped?.map((orden: any) => (
                        <TableRow key={orden.ordenProduccionId}>
                          <TableCell className="font-medium">{orden.receta?.nombre}</TableCell>
                          <TableCell>{orden.cantidad}</TableCell>
                          <TableCell>{getEstadoBadge(orden.estado)}</TableCell>
                          <TableCell>{orden.costoMateriales ? formatCurrency(orden.costoMateriales) : '-'}</TableCell>
                          <TableCell>{format(new Date(orden.fechaProduccion), 'dd/MM/yyyy')}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {String(orden.estado).toUpperCase() === 'PENDIENTE' && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setConfirmacion({ tipo: 'aprobar', ordenId: orden.ordenProduccionId, recetaNombre: orden.receta?.nombre, cantidad: orden.cantidad })}
                                >
                                  Aprobar
                                </Button>
                              )}
                              {String(orden.estado).toUpperCase() === 'EN_PROCESO' && (
                                <Button 
                                  variant="default" 
                                  size="sm"
                                  onClick={() => setConfirmacion({ tipo: 'completar', ordenId: orden.ordenProduccionId, recetaNombre: orden.receta?.nombre, cantidad: orden.cantidad })}
                                >
                                  Completar
                                </Button>
                              )}
                              {['PENDIENTE', 'EN_PROCESO'].includes(String(orden.estado).toUpperCase()) && (
                                <Button 
                                  variant="destructive" 
                                  size="sm"
                                  onClick={() => setConfirmacion({ tipo: 'cancelar', ordenId: orden.ordenProduccionId, recetaNombre: orden.receta?.nombre, cantidad: orden.cantidad })}
                                >
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vales Tab */}
        <TabsContent value="valesTyped">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Vales de Salida</CardTitle>
                  <CardDescription>Gestiona los valesTyped de salida de productosTyped</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={filtroConceptoVale} onValueChange={setFiltroConceptoVale}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Todos los conceptos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {conceptos?.map((concepto: any) => (
                        <SelectItem key={concepto} value={concepto}>
                          {concepto}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Dialog open={dialogValeOpen} onOpenChange={setDialogValeOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Nuevo Vale
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Nuevo Vale de Salida</DialogTitle>
                        <DialogDescription>
                          Registra la salida de productosTyped por un concepto
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="concepto">Concepto</Label>
                          <Input
                            id="concepto"
                            list="conceptos-list"
                            value={selectedConcepto}
                            onChange={(e) => setSelectedConcepto(e.target.value)}
                            placeholder="Ej: Mantenimiento, Arrendamiento..."
                          />
                          <datalist id="conceptos-list">
                            {conceptos?.map((concepto: any) => (
                              <option key={concepto} value={concepto} />
                            ))}
                          </datalist>
                        </div>
                        <div className="grid gap-2">
                          <Label>Productos</Label>
                          <Select onValueChange={agregarItemVale}>
                            <SelectTrigger>
                              <SelectValue placeholder="Agregar producto" />
                            </SelectTrigger>
                            <SelectContent>
                              {productosTyped?.filter(p => !valeItems.find(i => i.productoId === p.id)).map((producto) => (
                                <SelectItem key={producto.id} value={producto.id}>
                                  {producto.nombre} (Stock: {producto.stock})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {valeItems.length > 0 && (
                          <div className="rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Producto</TableHead>
                                  <TableHead>Cantidad</TableHead>
                                  <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {valeItems.map((item) => {
                                  const producto = productosTyped?.find(p => p.id === item.productoId)
                                  return (
                                    <TableRow key={item.productoId}>
                                      <TableCell>{producto?.nombre}</TableCell>
                                      <TableCell>
                                        <Input 
                                          type="number"
                                          min={1}
                                          max={producto?.stock || 1}
                                          value={item.cantidad}
                                          onChange={(e) => actualizarCantidadVale(item.productoId, parseInt(e.target.value) || 1)}
                                          className="w-20"
                                        />
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Button 
                                          variant="ghost" 
                                          size="icon"
                                          onClick={() => eliminarItemVale(item.productoId)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setDialogValeOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleCrearVale} disabled={valeItems.length === 0 || !selectedConcepto}>
                          Crear Vale
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Productos</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingVales ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">Cargando...</TableCell>
                      </TableRow>
                    ) : valesTyped?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">No hay valesTyped</TableCell>
                      </TableRow>
                    ) : (
                      valesTyped?.map((vale: any) => (
                        <TableRow key={vale.valeSalidaId}>
                          <TableCell className="font-medium">{vale.concepto}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {vale.items?.map((item: any) => (
                                <Badge key={item.valeSalidaItemId} variant="outline">
                                  {item.producto?.nombre} x{item.cantidad}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={vale.estado === 'completada' ? 'default' : 'secondary'}>
                              {vale.estado}
                            </Badge>
                          </TableCell>
                          <TableCell>{format(new Date(vale.createdAt), 'dd/MM/yyyy')}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon">
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: Ver Receta */}
      <Dialog open={recetaVer !== null} onOpenChange={(open) => { if (!open) setRecetaVer(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{recetaVer?.nombre}</DialogTitle>
            <DialogDescription>Detalle completo de la receta de producción</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="font-medium">Rendimiento:</span> {recetaVer?.rendimiento} unidad(es)</div>
              <div><span className="font-medium">Producto asociado:</span> {recetaVer?.producto?.nombre || '—'}</div>
              <div><span className="font-medium">Instrucciones:</span> {recetaVer?.instrucciones || 'No especificado'}</div>
              <div><span className="font-medium">Tiempo de prep.:</span> {recetaVer?.tiempoPrep ? `${recetaVer.tiempoPrep} min` : 'No especificado'}</div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Ingredientes</p>
              {recetaVer?.ingredientes?.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin ingredientes definidos</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Desperdicio</TableHead>
                        <TableHead className="text-right">Costo estimado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recetaVer?.ingredientes?.map((ing: any) => (
                        <TableRow key={ing.productoId}>
                          <TableCell>{ing.producto?.nombre}</TableCell>
                          <TableCell>{ing.cantidad}</TableCell>
                          <TableCell>{((ing.desperdicio ?? 0) * 100).toFixed(0)}%</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency((ing.producto?.precioCosto ?? 0) * ing.cantidad * (1 + (ing.desperdicio ?? 0)))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center pt-2 border-t text-sm">
              <span className="font-medium">Costo unitario total</span>
              <span className="font-bold">{formatCurrency(recetaVer?.costoUnitario || 0)}</span>
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setRecetaVer(null)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar Receta */}
      <Dialog open={recetaEdit !== null} onOpenChange={(open) => { if (!open) setRecetaEdit(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Receta</DialogTitle>
            <DialogDescription>Modificá los metadatos y los ingredientes de la receta</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editNombre">Nombre</Label>
              <Input
                id="editNombre"
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
                className={!editNombre ? 'border-destructive' : ''}
              />
              {!editNombre && <p className="text-xs text-destructive">El nombre es obligatorio</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="editRendimiento">Rendimiento</Label>
                <Input
                  id="editRendimiento"
                  type="number"
                  min={1}
                  value={editRendimiento}
                  onChange={(e) => setEditRendimiento(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Producto asociado</Label>
                <Select value={editProductoId} onValueChange={setEditProductoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sin producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {productosTyped?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Ingredientes</Label>
              <Select
                onValueChange={(productoId) => {
                  if (!editItems.find((i) => i.productoId === productoId)) {
                    setEditItems([...editItems, { productoId, cantidad: 1, desperdicio: 0 }])
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Agregar ingrediente" />
                </SelectTrigger>
                <SelectContent>
                  {productosTyped?.filter((p) => !editItems.find((i) => i.productoId === p.id)).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editItems.length > 0 && (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Desperdicio</TableHead>
                        <TableHead className="text-right">Quitar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editItems.map((item) => {
                        const prod = productosTyped?.find((p) => p.id === item.productoId)
                        return (
                          <TableRow key={item.productoId}>
                            <TableCell>{prod?.nombre}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0.01}
                                step={0.01}
                                value={item.cantidad}
                                onChange={(e) => setEditItems(editItems.map((i) => i.productoId === item.productoId ? { ...i, cantidad: parseFloat(e.target.value) || 1 } : i))}
                                className="w-20"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                max={1}
                                step={0.01}
                                value={item.desperdicio}
                                onChange={(e) => setEditItems(editItems.map((i) => i.productoId === item.productoId ? { ...i, desperdicio: parseFloat(e.target.value) || 0 } : i))}
                                className="w-20"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditItems(editItems.filter((i) => i.productoId !== item.productoId))}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRecetaEdit(null)}>Cancelar</Button>
            <Button onClick={handleGuardarEdicion} disabled={!editNombre}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Confirmar eliminación de receta */}
      <AlertDialog open={recetaEliminar !== null} onOpenChange={(open) => { if (!open) setRecetaEliminar(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar receta</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar la receta <strong>{recetaEliminar?.nombre}</strong>? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRecetaEliminar(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (recetaEliminar) {
                  deleteReceta(recetaEliminar.recetaId)
                  setRecetaEliminar(null)
                }
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog de confirmación para acciones de estado */}
      <AlertDialog open={confirmacion !== null} onOpenChange={(open) => { if (!open) setConfirmacion(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmacion?.tipo === 'aprobar' && 'Aprobar orden de producción'}
              {confirmacion?.tipo === 'completar' && 'Completar orden de producción'}
              {confirmacion?.tipo === 'cancelar' && 'Cancelar orden de producción'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmacion?.tipo === 'aprobar' && (
                <>¿Confirmar aprobación de <strong>{confirmacion.recetaNombre}</strong> (cantidad: {confirmacion.cantidad})? Se reservarán los materiales del inventario.</>
              )}
              {confirmacion?.tipo === 'completar' && (
                <>¿Confirmar que la producción de <strong>{confirmacion?.recetaNombre}</strong> está terminada? Se incrementará el stock del producto terminado.</>
              )}
              {confirmacion?.tipo === 'cancelar' && (
                <>¿Cancelar la orden de <strong>{confirmacion?.recetaNombre}</strong>? Si estaba en proceso, los materiales reservados serán liberados al inventario.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmacion(null)}>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmacion) return
                if (confirmacion.tipo === 'aprobar') handleAprobarOrden(confirmacion.ordenId)
                if (confirmacion.tipo === 'completar') handleCompletarOrden(confirmacion.ordenId)
                if (confirmacion.tipo === 'cancelar') handleCancelarOrden(confirmacion.ordenId)
                setConfirmacion(null)
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
