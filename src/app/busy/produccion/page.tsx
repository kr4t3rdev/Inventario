'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
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
import { OrdenProduccion, RecetaProduccion, Producto } from '@/app/models/model'
import { 
  Factory, 
  Plus, 
  Search, 
  Package, 
  ClipboardList, 
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Edit,
  Eye
} from 'lucide-react'
import { format } from 'date-fns'
import {
  MASS_UNITS,
  VOLUME_UNITS,
  formatIngrediente,
  formatIngredientesList,
} from '@/lib/utils/unit-converter'
import { PRODUCTION_STATE_LABELS, PRODUCTION_STATES } from '@/lib/constants/production'
import {
  validateAndNormalizeIngredientUnit,
  type UnitError,
  type UnitNormalization,
} from '@/lib/validators/production-units'
import { filterProductos } from '@/lib/utils/produccion'
import { 
  useGetRecetasProduccionQuery, 
  useGetOrdenesProduccionQuery, 
  useCreateRecetaProduccionMutation,
  useSetIngredientesRecetaProduccionMutation,
  useCreateOrdenProduccionMutation,
  useAprobarOrdenProduccionMutation,
  useCompletarOrdenProduccionMutation,
  useCancelarOrdenProduccionMutation,
  useDeleteRecetaProduccionMutation,
  useUpdateRecetaProduccionMutation
} from '@/lib/redux/services/produccionApi'
import { getProductosAction } from '@/features/productos'

import { RecipeOutputSelector, type RecipeOutputMode } from '@/features/produccion/components/recipe-output-selector'
import { ProductionDialogs } from '@/features/produccion/components/production-dialogs'
import { RecipeEditorDialog } from '@/features/produccion/components/recipe-editor-dialog'

type RecipeEditorItem = {
  productoId: string
  cantidad: number
  unidadSimbolo: string | null
  desperdicio: number
}

type PreviewProduct = {
  id: string
  nombre: string
  unidad?: {
    simbolo?: string | null
  } | null
}

type RecipeUnitPreviewRow = {
  productoId: string
  blockingMessage: string | null
  normalizationMessage: string | null
}

type RecipeUnitPreview = {
  hasBlockingIssues: boolean
  blockingMessages: string[]
  normalizationMessages: string[]
  rows: RecipeUnitPreviewRow[]
}

type ProductionApiError = {
  data?: {
    error?: string
    unitErrors?: UnitError[]
    materialesFaltantes?: Array<{
      productoNombre: string
      requerido: number
      disponible: number
    }>
  }
}

function formatPreviewQuantity(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return parseFloat(value.toFixed(3)).toString()
}

function formatUnitLabel(unit: string | null | undefined): string {
  return unit?.trim() || 'sin unidad'
}

function formatUnitErrorMessage(error: UnitError): string {
  switch (error.reason) {
    case 'missing_unit':
      return `${error.productoNombre ?? 'Producto'}: Debés especificar una unidad para este producto.`
    case 'unknown_unit':
      return `${error.productoNombre ?? 'Producto'}: La unidad ingresada no es reconocida.`
    case 'missing_product':
      return `Producto no encontrado en catálogo: ${error.productoId}.`
    case 'incompatible_category':
    default:
      return `${error.productoNombre ?? 'Producto'}: La unidad ${formatUnitLabel(error.providedUnit)} no es compatible con ${formatUnitLabel(error.canonicalUnit)}.`
  }
}

export function formatUnitNormalizationMessage(normalization: UnitNormalization): string {
  return `${normalization.productoNombre}: ${formatPreviewQuantity(normalization.originalCantidad)} ${formatUnitLabel(normalization.providedUnit)} se guardará como ${formatPreviewQuantity(normalization.normalizedCantidad)} ${formatUnitLabel(normalization.canonicalUnit)}.`
}

export function buildRecipeUnitPreview(
  items: RecipeEditorItem[],
  productos: PreviewProduct[]
): RecipeUnitPreview {
  const rows = items.map((item) => {
    const producto = productos.find((prod) => prod.id === item.productoId)

    if (!producto) {
      return {
        productoId: item.productoId,
        blockingMessage: `Producto no encontrado en catálogo: ${item.productoId}.`,
        normalizationMessage: null,
      }
    }

    const result = validateAndNormalizeIngredientUnit(item, {
      id: producto.id,
      nombre: producto.nombre,
      unidadSimbolo: producto.unidad?.simbolo ?? null,
    })

    return {
      productoId: item.productoId,
      blockingMessage: result.error ? formatUnitErrorMessage(result.error) : null,
      normalizationMessage: result.normalization
        ? formatUnitNormalizationMessage(result.normalization)
        : null,
    }
  })

  const blockingMessages = rows
    .map((row) => row.blockingMessage)
    .filter((message): message is string => Boolean(message))

  const normalizationMessages = rows
    .map((row) => row.normalizationMessage)
    .filter((message): message is string => Boolean(message))

  return {
    hasBlockingIssues: blockingMessages.length > 0,
    blockingMessages,
    normalizationMessages,
    rows,
  }
}

/**
 * @description Página principal del módulo de Producción.
 * @returns {JSX.Element} Componente de página de producción.
 */
export default function ProduccionPage() {
  const [searchRecetas, setSearchRecetas] = useState('')
  const [searchOrdenes, setSearchOrdenes] = useState('')
  const [filtroEstadoOrden, setFiltroEstadoOrden] = useState<string>('all')
  
  // Dialog states
  const [dialogRecetaOpen, setDialogRecetaOpen] = useState(false)
  const [dialogOrdenOpen, setDialogOrdenOpen] = useState(false)
  const [confirmacion, setConfirmacion] = useState<{ tipo: 'aprobar' | 'completar' | 'cancelar'; ordenId: string; recetaNombre: string; cantidad: number } | null>(null)
  const [recetaVer, setRecetaVer] = useState<RecetaProduccion | null>(null)
  const [recetaEliminar, setRecetaEliminar] = useState<{ recetaId: string; nombre: string } | null>(null)
  const [recetaEdit, setRecetaEdit] = useState<RecetaProduccion | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editRendimiento, setEditRendimiento] = useState<number | string>(1)
  const [editProductoId, setEditProductoId] = useState('')
  const [outputMode, setOutputMode] = useState<RecipeOutputMode>('existing')
  const [editOutputMode, setEditOutputMode] = useState<RecipeOutputMode>('existing')
  const [createdOutputProductName, setCreatedOutputProductName] = useState<string | null>(null)
  const [editCreatedOutputProductName, setEditCreatedOutputProductName] = useState<string | null>(null)
  const [editItems, setEditItems] = useState<Array<{ productoId: string; cantidad: number; unidadSimbolo: string | null; desperdicio: number }>>([])

  // Data
  const { data: recetasTyped, isLoading: loadingRecetas } = useGetRecetasProduccionQuery(searchRecetas ? { search: searchRecetas } : undefined)
  const { data: ordenesTyped, isLoading: loadingOrdenes } = useGetOrdenesProduccionQuery(filtroEstadoOrden !== 'all' ? { estado: filtroEstadoOrden } : undefined)
  const [productosTyped, setProductosTyped] = useState<any[]>([])
  const [loadingProductos, setLoadingProductos] = useState(true)

  useEffect(() => {
    getProductosAction().then(r => {
      if (r.success) setProductosTyped(r.data ?? [])
      setLoadingProductos(false)
    })
  }, [])


  // Mutations
  const [createReceta] = useCreateRecetaProduccionMutation()
  const [setIngredientes] = useSetIngredientesRecetaProduccionMutation()
  const [createOrden] = useCreateOrdenProduccionMutation()
  const [aprobarOrden] = useAprobarOrdenProduccionMutation()
  const [completarOrden] = useCompletarOrdenProduccionMutation()
  const [cancelarOrden] = useCancelarOrdenProduccionMutation()
  const [deleteReceta] = useDeleteRecetaProduccionMutation()
  const [updateReceta] = useUpdateRecetaProduccionMutation()

  // Form states
  const [nombreReceta, setNombreReceta] = useState('')
  const [rendimiento, setRendimiento] = useState<number | string>(1)
  const [selectedProducto, setSelectedProducto] = useState('')
  const [selectedReceta, setSelectedReceta] = useState('')
  const [cantidadOrden, setCantidadOrden] = useState(1)
  const [nuevoItems, setNuevoItems] = useState<RecipeEditorItem[]>([])
  const [busquedaProductos, setBusquedaProductos] = useState('')

  const UNIT_OPTION_NONE = 'none'
  const NO_CONVERSION_UNITS = ['unidad', 'pieza']

  const getRecetaIngredientes = (receta: RecetaProduccion | null | undefined) => {
    return receta?.ingredientes ?? (receta as any)?.RecetaIngrediente ?? []
  }

  const getRecetaProducto = (receta: RecetaProduccion | null | undefined) => {
    return receta?.producto ?? (receta as any)?.Producto ?? null
  }

  const getIngredienteProducto = (ingrediente: RecetaProduccion['ingredientes'][number] | null | undefined) => {
    return ingrediente?.producto ?? (ingrediente as any)?.Producto ?? null
  }

  const getInsumosTexto = (receta: RecetaProduccion | null | undefined) => {
    const nombres = getRecetaIngredientes(receta)
      .map((ing: { producto?: { nombre?: string } }) => ing?.producto?.nombre)
      .filter(Boolean)

    if (nombres.length === 0) return '-'
    if (nombres.length <= 2) return nombres.join(', ')
    return `${nombres.slice(0, 2).join(', ')} +${nombres.length - 2}`
  }

  const getUnitSelectValue = (unidadSimbolo: string | null | undefined) => {
    return unidadSimbolo ?? UNIT_OPTION_NONE
  }

  const parseUnitSelectValue = (value: string) => {
    return value === UNIT_OPTION_NONE ? null : value
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'CUP',
    }).format(amount)
  }

  const getProductosFiltrados = () => {
    return filterProductos(
      busquedaProductos,
      productosTyped?.filter((p) => !nuevoItems.find((i) => i.productoId === p.id)) || []
    )
  }

  const recetasList = recetasTyped?.data || []
  const ordenesList = ordenesTyped?.data || []
  const recetasOperativas = recetasList.filter((receta) => Boolean(getRecetaProducto(receta)?.id)) || []

  const newRecipePreview = buildRecipeUnitPreview(nuevoItems, productosTyped || [])
  const editRecipePreview = buildRecipeUnitPreview(editItems, productosTyped || [])

  const getPreviewRowState = (preview: RecipeUnitPreview, productoId: string) =>
    preview.rows.find((row) => row.productoId === productoId) ?? {
      productoId,
      blockingMessage: null,
      normalizationMessage: null,
    }

  const getEstadoBadge = (estado: string) => {
    switch (String(estado).toUpperCase()) {
      case PRODUCTION_STATES.PENDIENTE:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> {PRODUCTION_STATE_LABELS.PENDIENTE}</Badge>
      case PRODUCTION_STATES.EN_PROCESO:
        return <Badge variant="default"><Clock className="w-3 h-3 mr-1" /> {PRODUCTION_STATE_LABELS.EN_PROCESO}</Badge>
      case PRODUCTION_STATES.COMPLETADA:
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> {PRODUCTION_STATE_LABELS.COMPLETADA}</Badge>
      case PRODUCTION_STATES.CANCELADA:
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> {PRODUCTION_STATE_LABELS.CANCELADA}</Badge>
      default:
        return <Badge>{estado}</Badge>
    }
  }

  const handleCrearReceta = async () => {
    if (!nombreReceta) return
    if (!selectedProducto) {
      toast.error('Debés seleccionar o crear el producto final de salida.')
      return
    }
    
    const rendimientoValue = typeof rendimiento === 'string' ? parseInt(rendimiento) : rendimiento
    if (!rendimientoValue || rendimientoValue < 1) return
    
    try {
      const result = await createReceta({
        nombre: nombreReceta,
        rendimiento: rendimientoValue,
        productoId: selectedProducto || undefined
      }).unwrap()

      if (nuevoItems.length > 0) {
        const ingredientesResult = await setIngredientes({
          recetaId: result.recetaId,
          ingredientes: nuevoItems,
        }).unwrap()

        if (ingredientesResult?.unitNormalizations?.length) {
          toast.success('Receta creada', {
            description: ingredientesResult.unitNormalizations
              .map(formatUnitNormalizationMessage)
              .join(' '),
          })
        } else {
          toast.success('Receta creada')
        }
      } else {
        toast.success('Receta creada')
      }
      
      setDialogRecetaOpen(false)
      setNombreReceta('')
      setRendimiento(1)
      setSelectedProducto('')
      setOutputMode('existing')
      setCreatedOutputProductName(null)
      setNuevoItems([])
    } catch (error) {
      const unitErrors = (error as ProductionApiError)?.data?.unitErrors
      if (Array.isArray(unitErrors) && unitErrors.length > 0) {
        toast.error('No se pudo guardar la receta', {
          description: unitErrors.map(formatUnitErrorMessage).join(' '),
        })
      }
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

  const handleAprobarOrden = async (ordenId: string) => {
    try {
      const result = await aprobarOrden({ ordenProduccionId: ordenId }).unwrap()
      toast.success('Orden aprobada', {
        description: 'Materiales reservados exitosamente'
      })
    } catch (error: unknown) {
      const apiError = error as ProductionApiError
      if (apiError?.data?.materialesFaltantes && apiError.data.materialesFaltantes.length > 0) {
        const faltantes = (apiError.data.materialesFaltantes ?? [])
          .map((m) => `${m.productoNombre}: necesita ${m.requerido}, disponible ${m.disponible}`)
          .join('\n')
        toast.error('Materiales insuficientes', {
          description: faltantes
        })
      } else if (apiError?.data?.error) {
        toast.error('Error', {
          description: apiError.data.error
        })
      } else {
        toast.error('Error al aprobar orden', {
          description: 'Intenta de nuevo'
        })
      }
      console.error('Error al aprobar orden:', error)
    }
  }

  const handleCompletarOrden = async (ordenId: string) => {
    try {
      const result = await completarOrden({ ordenProduccionId: ordenId }).unwrap()
      toast.success('Orden completada', {
        description: 'Stock del producto final incrementado'
      })
    } catch (error: unknown) {
      const apiError = error as ProductionApiError
      if (apiError?.data?.error) {
        toast.error('Error al completar orden', {
          description: apiError.data.error
        })
      } else {
        toast.error('Error', {
          description: 'Intenta de nuevo'
        })
      }
      console.error('Error al completar orden:', error)
    }
  }

  const handleCancelarOrden = async (ordenId: string) => {
    try {
      const result = await cancelarOrden({ ordenProduccionId: ordenId, observaciones: 'Cancelado por usuario' }).unwrap()
      toast.success('Orden cancelada', {
        description: 'Los materiales reservados han sido liberados al inventario'
      })
    } catch (error: unknown) {
      const apiError = error as ProductionApiError
      if (apiError?.data?.error) {
        toast.error('Error al cancelar orden', {
          description: apiError.data.error
        })
      } else {
        toast.error('Error', {
          description: 'Intenta de nuevo'
        })
      }
      console.error('Error al cancelar orden:', error)
    }
  }

  const handleGuardarEdicion = async () => {
    if (!editNombre || !recetaEdit) return
    if (!editProductoId) {
      toast.error('Debés seleccionar o crear el producto final de salida.')
      return
    }
    
    const editRendimientoValue = typeof editRendimiento === 'string' ? parseInt(editRendimiento) : editRendimiento
    if (!editRendimientoValue || editRendimientoValue < 1) return
    
    try {
      await updateReceta({
        recetaId: recetaEdit.recetaId,
        payload: {
          nombre: editNombre,
          rendimiento: editRendimientoValue,
          productoId: editProductoId || undefined,
        },
      }).unwrap()
      await setIngredientes({
        recetaId: recetaEdit.recetaId,
        ingredientes: editItems,
      }).unwrap()
      toast.success('Receta actualizada')
      setRecetaEdit(null)
      setEditOutputMode('existing')
      setEditCreatedOutputProductName(null)
    } catch (error) {
      const unitErrors = (error as ProductionApiError)?.data?.unitErrors
      if (Array.isArray(unitErrors) && unitErrors.length > 0) {
        toast.error('No se pudo actualizar la receta', {
          description: unitErrors.map(formatUnitErrorMessage).join(' '),
        })
      }
      console.error('Error al guardar receta:', error)
    }
  }

  const agregarItemNuevo = (productoId: string) => {
    if (nuevoItems.find(i => i.productoId === productoId)) return
    setNuevoItems([...nuevoItems, { productoId, cantidad: 1, unidadSimbolo: null, desperdicio: 0 }])
  }

  const actualizarItemNuevo = (
    productoId: string,
    changes: Partial<{ cantidad: number; unidadSimbolo: string | null; desperdicio: number }>
  ) => {
    setNuevoItems(nuevoItems.map((item) =>
      item.productoId === productoId ? { ...item, ...changes } : item
    ))
  }

  const eliminarItemNuevo = (productoId: string) => {
    setNuevoItems(nuevoItems.filter((item) => item.productoId !== productoId))
  }

  // Stats
  const ordenesStats = ordenesTyped?.meta?.stats
  const ordenesPendientes = ordenesStats?.pendientes || 0
  const ordenesEnProceso = ordenesStats?.enProceso || 0
  const ordenesCompletadas = ordenesStats?.completadas || 0

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
            <div className="text-2xl font-bold">{recetasTyped?.meta?.total || 0}</div>
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
                  <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                    <DialogHeader className="shrink-0">
                      <DialogTitle>Nueva Receta de Producción</DialogTitle>
                      <DialogDescription>
                        Define una receta para producir productos del inventario
                      </DialogDescription>
                    </DialogHeader>

                    {(newRecipePreview.blockingMessages.length > 0 || newRecipePreview.normalizationMessages.length > 0) && (
                      <div className={`shrink-0 p-4 rounded-r-md ${newRecipePreview.hasBlockingIssues ? 'border-l-4 border-yellow-500 bg-yellow-50' : 'border-l-4 border-blue-500 bg-blue-50'}`}>
                        <div className="flex">
                          <div className="shrink-0">
                            <span className={`text-2xl ${newRecipePreview.hasBlockingIssues ? 'text-yellow-500' : 'text-blue-500'}`}>
                              {newRecipePreview.hasBlockingIssues ? '⚠️' : 'ℹ️'}
                            </span>
                          </div>
                          <div className="ml-3">
                            <p className={`text-sm font-medium ${newRecipePreview.hasBlockingIssues ? 'text-yellow-800' : 'text-blue-800'}`}>
                              {newRecipePreview.hasBlockingIssues ? 'Problemas de Unidad de Medida' : 'Normalización de Unidad de Medida'}
                            </p>
                            {newRecipePreview.blockingMessages.length > 0 && (
                              <ul className="mt-2 list-disc list-inside text-sm text-yellow-700 space-y-1">
                                {newRecipePreview.blockingMessages.map((warning, idx) => (
                                  <li key={`block-${idx}`}>{warning}</li>
                                ))}
                              </ul>
                            )}
                            {newRecipePreview.normalizationMessages.length > 0 && (
                              <ul className={`mt-2 list-disc list-inside text-sm space-y-1 ${newRecipePreview.hasBlockingIssues ? 'text-blue-700' : 'text-blue-700'}`}>
                                {newRecipePreview.normalizationMessages.map((message, idx) => (
                                  <li key={`norm-${idx}`}>{message}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Contenido scrollable */}
                    <div className="flex-1 overflow-y-auto pr-4 space-y-6">
                      {/* SECCIÓN 1: Datos Básicos */}
                      <div className="space-y-4 border-b pb-4">
                        <h3 className="font-semibold text-sm">Información General</h3>
                        <div className="grid grid-cols-2 gap-4">
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
                              onChange={(e) => {
                                const val = e.target.value
                                if (val === '') {
                                  setRendimiento('')
                                } else {
                                  const num = parseInt(val)
                                  setRendimiento(num >= 1 ? num : 1)
                                }
                              }}
                              placeholder="1"
                            />
                          </div>
                        </div>
                        <RecipeOutputSelector
                          createdProductName={createdOutputProductName}
                          onCreatedProduct={(product) => {
                            setSelectedProducto(product.id)
                            setCreatedOutputProductName(product.nombre)
                          }}
                          onModeChange={setOutputMode}
                          onProductChange={setSelectedProducto}
                          products={productosTyped?.map((product) => ({
                            id: product.id,
                            nombre: product.nombre,
                          })) || []}
                          selectedMode={outputMode}
                          selectedProductId={selectedProducto}
                        />
                      </div>

                      {/* SECCIÓN 2: Búsqueda Expandida de Productos */}
                      <div className="space-y-3">
                        <h3 className="font-semibold text-sm">Agregar Productos a la Receta</h3>
                        <div className="grid gap-2">
                          <Label htmlFor="busqueda">Buscar Productos</Label>
                          <Input 
                            id="busqueda"
                            placeholder="Escribe el nombre del producto..."
                            value={busquedaProductos}
                            onChange={(e) => setBusquedaProductos(e.target.value)}
                            className="h-10"
                          />
                        </div>
                        
                        {/* Grid de productos filtrados */}
                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3 bg-muted/30">
                          {getProductosFiltrados().length === 0 ? (
                            <div className="col-span-2 text-center text-sm text-muted-foreground py-4">
                              {busquedaProductos ? 'No se encontraron productos' : 'Comienza a escribir para buscar...'}
                            </div>
                          ) : (
                            getProductosFiltrados().map((p) => (
                              <Button
                                key={p.id}
                                variant="outline"
                                className="justify-start text-left h-auto py-2 px-3 text-xs"
                                onClick={() => {
                                  agregarItemNuevo(p.id)
                                  setBusquedaProductos('')
                                }}
                              >
                                <div className="flex flex-col gap-0.5 w-full">
                                  <span className="text-xs font-medium">{p.nombre}</span>
                                  <span className="text-xs text-muted-foreground">
                                    ${p.precioCosto} (Stock: {p.stock})
                                  </span>
                                </div>
                              </Button>
                            ))
                          )}
                        </div>
                      </div>

                      {/* SECCIÓN 3: Tabla de Productos Agregados */}
                      {nuevoItems.length > 0 && (
                        <div className="space-y-3 border-t pt-4">
                          <h3 className="font-semibold text-sm">Productos Agregados ({nuevoItems.length})</h3>
                          <div className="rounded-md border overflow-x-auto max-h-48 overflow-y-auto">
                            <Table className="text-xs">
                              <TableHeader className="sticky top-0 bg-muted">
                                <TableRow>
                                  <TableHead className="text-xs">Producto</TableHead>
                                  <TableHead className="text-xs">Cantidad</TableHead>
                                  <TableHead className="text-xs">Unidad</TableHead>
                                  <TableHead className="text-xs">Desperdicio</TableHead>
                                  <TableHead className="text-right text-xs">Quitar</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {nuevoItems.map((item) => {
                                  const prod = productosTyped?.find((p) => p.id === item.productoId)
                                  const previewRow = getPreviewRowState(newRecipePreview, item.productoId)
                                  return (
                                    <TableRow key={item.productoId} className="text-xs">
                                      <TableCell className="text-xs whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                          <span>{prod?.nombre}</span>
                                          {previewRow.blockingMessage && (
                                            <span className="text-yellow-600 text-lg" title={previewRow.blockingMessage}>⚠️</span>
                                          )}
                                          {!previewRow.blockingMessage && previewRow.normalizationMessage && (
                                            <span className="text-blue-600 text-lg" title={previewRow.normalizationMessage}>ℹ️</span>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-xs">
                                        <Input
                                          type="number"
                                          min={0.01}
                                          step={0.01}
                                          value={item.cantidad}
                                          onChange={(e) => actualizarItemNuevo(item.productoId, { cantidad: parseFloat(e.target.value) || 1 })}
                                          className="w-20 text-xs h-7"
                                        />
                                      </TableCell>
                                      <TableCell className="text-xs">
                                        <Select
                                          value={getUnitSelectValue(item.unidadSimbolo)}
                                          onValueChange={(value) => actualizarItemNuevo(item.productoId, { unidadSimbolo: parseUnitSelectValue(value) })}
                                        >
                                          <SelectTrigger className="w-24 text-xs h-7">
                                            <SelectValue placeholder="Sin unidad" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value={UNIT_OPTION_NONE}>Sin unidad</SelectItem>
                                            {MASS_UNITS.map((unit) => (
                                              <SelectItem key={`mass-${unit}`} value={unit}>{unit}</SelectItem>
                                            ))}
                                            {VOLUME_UNITS.map((unit) => (
                                              <SelectItem key={`volume-${unit}`} value={unit}>{unit}</SelectItem>
                                            ))}
                                            {NO_CONVERSION_UNITS.map((unit) => (
                                              <SelectItem key={`plain-${unit}`} value={unit}>{unit}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </TableCell>
                                      <TableCell className="text-xs">
                                        <Input
                                          type="number"
                                          min={0}
                                          max={1}
                                          step={0.01}
                                          value={item.desperdicio}
                                          onChange={(e) => actualizarItemNuevo(item.productoId, { desperdicio: parseFloat(e.target.value) || 0 })}
                                          className="w-20 text-xs h-7"
                                        />
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={() => eliminarItemNuevo(item.productoId)}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer con botones - fixed */}
                    <div className="flex justify-end gap-2 border-t pt-4 shrink-0">
                      <Button variant="outline" onClick={() => {
                        setDialogRecetaOpen(false)
                        setNombreReceta('')
                        setRendimiento(1)
                        setSelectedProducto('')
                        setOutputMode('existing')
                        setCreatedOutputProductName(null)
                        setNuevoItems([])
                        setBusquedaProductos('')
                      }}>
                        Cancelar
                      </Button>
                      {(() => {
                        return newRecipePreview.hasBlockingIssues ? (
                          <Button 
                            disabled 
                            className="bg-destructive/50 cursor-not-allowed" 
                            title="Arregla los problemas de unidades antes de continuar"
                          >
                            ⚠️ Arreglar Unidades
                          </Button>
                        ) : (
                          <Button onClick={handleCrearReceta}>
                            Crear Receta
                          </Button>
                        );
                      })()}
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
                    ) : recetasList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center">No hay recetas</TableCell>
                      </TableRow>
                    ) : (
                      recetasList.map((receta: RecetaProduccion) => (
                        <TableRow key={receta.recetaId}>
                          <TableCell className="font-medium">{receta.nombre}</TableCell>
                          <TableCell>{receta.rendimiento}</TableCell>
                          <TableCell>
                            {getRecetaProducto(receta)?.nombre ? (
                              getRecetaProducto(receta)?.nombre
                            ) : (
                              <Badge variant='destructive'>Sin producto final</Badge>
                            )}
                          </TableCell>
                          <TableCell>{formatIngredientesList(getRecetaIngredientes(receta))}</TableCell>
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
                                  setEditProductoId(getRecetaProducto(receta)?.id || '')
                                  setEditOutputMode(getRecetaProducto(receta)?.id ? 'existing' : 'create')
                                  setEditCreatedOutputProductName(null)
                                  setEditItems(getRecetaIngredientes(receta).map((i: { productoId: string; cantidad: number; unidadSimbolo?: string | null; desperdicio?: number }) => ({
                                    productoId: i.productoId,
                                    cantidad: i.cantidad,
                                    unidadSimbolo: i.unidadSimbolo ?? null,
                                    desperdicio: i.desperdicio ?? 0,
                                  })))
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
                      <SelectItem value={PRODUCTION_STATES.PENDIENTE}>{PRODUCTION_STATE_LABELS.PENDIENTE}</SelectItem>
                      <SelectItem value={PRODUCTION_STATES.EN_PROCESO}>{PRODUCTION_STATE_LABELS.EN_PROCESO}</SelectItem>
                      <SelectItem value={PRODUCTION_STATES.COMPLETADA}>{PRODUCTION_STATE_LABELS.COMPLETADA}</SelectItem>
                      <SelectItem value={PRODUCTION_STATES.CANCELADA}>{PRODUCTION_STATE_LABELS.CANCELADA}</SelectItem>
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
                              {recetasOperativas.map((receta: any) => (
                                <SelectItem key={receta.recetaId} value={receta.recetaId}>
                                  {receta.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {recetasTyped && recetasOperativas.length !== recetasList.length ? (
                            <p className='text-xs text-muted-foreground'>
                              Las recetas sin producto final configurado no se pueden usar para crear órdenes.
                            </p>
                          ) : null}
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="cantidad">Cantidad de Lotes</Label>
                          <Input 
                            id="cantidad" 
                            type="number"
                            min={1}
                            value={cantidadOrden}
                            onChange={(e) => setCantidadOrden(parseInt(e.target.value) || 1)}
                          />
                          {(() => {
                            const recetaSeleccionada = recetasOperativas.find((r: any) => r.recetaId === selectedReceta)
                            if (recetaSeleccionada?.rendimiento && cantidadOrden > 0) {
                              return (
                                <p className="text-xs text-muted-foreground">
                                  Se producirán {cantidadOrden * recetaSeleccionada.rendimiento} unidad(es) de producto final
                                  (rendimiento: {recetaSeleccionada.rendimiento} unid/lote)
                                </p>
                              )
                            }
                            return null
                          })()}
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
                    ) : ordenesList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">No hay órdenes</TableCell>
                      </TableRow>
                    ) : (
                        ordenesList.map((orden: OrdenProduccion) => (
                        <TableRow key={orden.ordenProduccionId}>
                          <TableCell className="font-medium">{orden.receta?.nombre}</TableCell>
                          <TableCell>{orden.cantidad}</TableCell>
                          <TableCell>{getEstadoBadge(orden.estado)}</TableCell>
                          <TableCell>{orden.costoMateriales ? formatCurrency(orden.costoMateriales) : '-'}</TableCell>
                          <TableCell>{format(new Date(orden.fechaProduccion), 'dd/MM/yyyy')}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {String(orden.estado).toUpperCase() === PRODUCTION_STATES.PENDIENTE && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setConfirmacion({ tipo: 'aprobar', ordenId: orden.ordenProduccionId, recetaNombre: orden.receta?.nombre ?? '', cantidad: orden.cantidad })}
                                >
                                  Aprobar
                                </Button>
                              )}
                              {String(orden.estado).toUpperCase() === PRODUCTION_STATES.EN_PROCESO && (
                                <Button 
                                  variant="default" 
                                  size="sm"
                                  onClick={() => setConfirmacion({ tipo: 'completar', ordenId: orden.ordenProduccionId, recetaNombre: orden.receta?.nombre ?? '', cantidad: orden.cantidad })}
                                >
                                  Completar
                                </Button>
                              )}
                              {[PRODUCTION_STATES.PENDIENTE, PRODUCTION_STATES.EN_PROCESO].includes(String(orden.estado).toUpperCase() as any) && (
                                <Button 
                                  variant="destructive" 
                                  size="sm"
                                  onClick={() => setConfirmacion({ tipo: 'cancelar', ordenId: orden.ordenProduccionId, recetaNombre: orden.receta?.nombre ?? '', cantidad: orden.cantidad })}
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

        {/* Vales de salida desactivado temporalmente. */}
      </Tabs>

      <ProductionDialogs
        recetaVer={recetaVer}
        recetaEliminar={recetaEliminar}
        confirmacion={confirmacion}
        onCloseView={() => setRecetaVer(null)}
        onCloseDelete={() => setRecetaEliminar(null)}
        onCloseConfirmation={() => setConfirmacion(null)}
        onDeleteRecipe={(recetaId) => {
          deleteReceta(recetaId)
          setRecetaEliminar(null)
        }}
        onConfirmApprove={(ordenId) => {
          handleAprobarOrden(ordenId)
          setConfirmacion(null)
        }}
        onConfirmComplete={(ordenId) => {
          handleCompletarOrden(ordenId)
          setConfirmacion(null)
        }}
        onConfirmCancel={(ordenId) => {
          handleCancelarOrden(ordenId)
          setConfirmacion(null)
        }}
      />

      <RecipeEditorDialog
        open={recetaEdit !== null}
        nombreReceta={editNombre}
        rendimiento={editRendimiento}
        selectedProducto={editProductoId}
        outputMode={editOutputMode}
        createdOutputProductName={editCreatedOutputProductName}
        productosTyped={productosTyped as any}
        busquedaProductos={busquedaProductos}
        nuevoItems={editItems}
        newRecipePreview={editRecipePreview}
        unitOptionNone={UNIT_OPTION_NONE}
        noConversionUnits={NO_CONVERSION_UNITS}
        onClose={() => setRecetaEdit(null)}
        onNombreChange={setEditNombre}
        onRendimientoChange={setEditRendimiento}
        onModeChange={setEditOutputMode}
        onProductChange={setEditProductoId}
        onCreatedProduct={(product) => {
          setEditProductoId(product.id)
          setEditCreatedOutputProductName(product.nombre)
        }}
        onBusquedaChange={setBusquedaProductos}
        onAddItem={(productoId) => {
          if (!editItems.find((i) => i.productoId === productoId)) {
            setEditItems([...editItems, { productoId, cantidad: 1, unidadSimbolo: null, desperdicio: 0 }])
          }
        }}
        onUpdateItem={(productoId, patch) => {
          setEditItems(editItems.map((i) => (i.productoId === productoId ? { ...i, ...patch } : i)))
        }}
        onRemoveItem={(productoId) => {
          setEditItems(editItems.filter((i) => i.productoId !== productoId))
        }}
        onSubmit={handleGuardarEdicion}
        onCancel={() => setRecetaEdit(null)}
      />

    </div>
  )
}
