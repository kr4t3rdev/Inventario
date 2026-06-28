'use client'

import { useEffect, useState } from 'react'
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Play,
  AlertTriangle,
  FileText,
  Calculator,
  Package,
  Truck,
  Wrench,
  DollarSign,
  Receipt,
  Globe,
  Handshake,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  getPlantillasAction,
  getPlantillaActivaAction,
  createPlantillaAction,
  updatePlantillaAction,
  activarPlantillaAction,
  deletePlantillaAction,
  aplicarPrecioSugeridoAction,
} from '../actions-plantilla'
import type {
  PlantillaCosto,
  PlantillaActivaResult,
  PlantillaCostoInput,
  UpdatePlantillaInput,
  LineItem,
  CategoriaCosto,
} from '../types'
import {
  CATEGORIAS_COSTO,
  lineItemTotal,
  calcularTotalLineItems,
  calcularTotalesPorCategoria,
} from '../types'
import { PlantillaForm } from './plantilla-form'

interface PlantillaCostoTabProps {
  productoId: string
  precioVenta: number
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)

const CATEGORIA_ICONOS: Record<string, React.ReactNode> = {
  'materiales': <Package className="h-4 w-4" />,
  'mano-obra': <Wrench className="h-4 w-4" />,
  'indirectos': <Receipt className="h-4 w-4" />,
  'transporte': <Truck className="h-4 w-4" />,
  'comisiones': <Handshake className="h-4 w-4" />,
  'empaque': <Package className="h-4 w-4" />,
  'aduana': <Globe className="h-4 w-4" />,
  'servicios': <DollarSign className="h-4 w-4" />,
  'otros': <Calculator className="h-4 w-4" />,
}

const CATEGORIA_LABEL = Object.fromEntries(
  CATEGORIAS_COSTO.map(c => [c.value, c.label])
)

/**
 * @description Pestaña de plantillas de ficha de costo. Muestra la plantilla
 *   activa con costo total y precio sugerido, la lista de versiones con
 *   acciones CRUD, y permite aplicar el precio sugerido al producto.
 */
export function PlantillaCostoTab({
  productoId,
  precioVenta,
}: PlantillaCostoTabProps) {
  const [plantillas, setPlantillas] = useState<PlantillaCosto[]>([])
  const [activa, setActiva] = useState<PlantillaActivaResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PlantillaCosto | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function load() {
    setIsLoading(true)
    setError(null)
    const [listaRes, activaRes] = await Promise.all([
      getPlantillasAction({ productoId }),
      getPlantillaActivaAction({ productoId }),
    ])
    if (!listaRes.success) {
      setError(listaRes.error?.message ?? 'Error cargando plantillas')
    } else {
      setPlantillas(listaRes.data)
    }
    if (!activaRes.success) {
      setError(activaRes.error?.message ?? 'Error cargando plantilla activa')
    } else {
      setActiva(activaRes.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    load()
  }, [productoId])

  async function handleCreate(data: PlantillaCostoInput) {
    setIsSubmitting(true)
    const res = await createPlantillaAction(data)
    setIsSubmitting(false)
    if (!res.success) {
      setError(res.error?.message ?? 'Error creando plantilla')
      return
    }
    setFormOpen(false)
    await load()
  }

  async function handleUpdate(data: UpdatePlantillaInput) {
    setIsSubmitting(true)
    const res = await updatePlantillaAction(data)
    setIsSubmitting(false)
    if (!res.success) {
      setError(res.error?.message ?? 'Error actualizando plantilla')
      return
    }
    setEditing(null)
    await load()
  }

  async function handleActivar(plantillaId: string) {
    const res = await activarPlantillaAction({ plantillaId, productoId })
    if (!res.success) {
      setError(res.error?.message ?? 'Error activando plantilla')
      return
    }
    await load()
  }

  async function handleEliminar(plantillaId: string) {
    if (!confirm('¿Eliminar esta plantilla? Esta acción no se puede deshacer.')) return
    const res = await deletePlantillaAction({ plantillaId })
    if (!res.success) {
      setError(res.error?.message ?? 'Error eliminando plantilla')
      return
    }
    await load()
  }

  async function handleAplicarPrecio(plantillaId: string) {
    if (!confirm('¿Aplicar el precio sugerido al producto?')) return
    const res = await aplicarPrecioSugeridoAction({ plantillaId, productoId })
    if (!res.success) {
      setError(res.error?.message ?? 'Error aplicando precio')
      return
    }
    await load()
  }

  return (
    <div className="space-y-6">
      {/* Plantilla activa */}
      {activa?.plantilla && (
        <div className="bg-muted/40 rounded-lg border p-4">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <h3 className="text-sm font-medium">
              Plantilla activa: {activa.plantilla.nombre}
            </h3>
            <Badge variant="outline">v{activa.plantilla.version}</Badge>
          </div>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <dt className="text-muted-foreground text-xs uppercase">Costo total</dt>
              <dd className="text-lg font-semibold">{fmt(activa.costoTotal)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase">Precio sugerido</dt>
              <dd className="text-lg font-semibold">{fmt(activa.precioSugerido)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase">Δ costo vs actual</dt>
              <dd
                className={`text-lg font-semibold ${
                  (activa.deltaCostoVsActual ?? 0) > 0 ? 'text-red-600' : 'text-green-600'
                }`}
              >
                {activa.deltaCostoVsActual === null
                  ? 'N/A'
                  : `${activa.deltaCostoVsActual > 0 ? '+' : ''}${fmt(activa.deltaCostoVsActual)}`}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase">Δ precio vs venta</dt>
              <dd
                className={`text-lg font-semibold ${
                  (activa.deltaPrecioVsVenta ?? 0) > 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {activa.deltaPrecioVsVenta === null
                  ? 'N/A'
                  : `${activa.deltaPrecioVsVenta > 0 ? '+' : ''}${fmt(activa.deltaPrecioVsVenta)}`}
              </dd>
            </div>
          </dl>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={() => handleAplicarPrecio(activa.plantilla!.id)}
              disabled={Math.round(activa.precioSugerido) === precioVenta}
            >
              <Play className="mr-1 h-3 w-3" />
              Aplicar precio sugerido
            </Button>
            {Math.round(activa.precioSugerido) === precioVenta && (
              <span className="text-muted-foreground flex items-center text-xs">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Precio ya aplicado
              </span>
            )}
          </div>
        </div>
      )}

      {!activa?.plantilla && !isLoading && (
        <div className="bg-muted/40 rounded-lg border p-4">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <p className="text-sm font-medium">No hay plantilla activa para este producto</p>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Cree una plantilla para calcular el precio sugerido basado en costos y margen objetivo.
          </p>
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Versiones</h3>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="mr-1 h-3 w-3" />
          Nueva plantilla
        </Button>
      </div>

      {error && (
        <div role="alert" className="text-destructive bg-card rounded border p-3 text-sm">
          {error}
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-lg border overflow-x-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-8" role="status">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}

        {!isLoading && plantillas.length === 0 && (
          <div className="text-muted-foreground p-8 text-center text-sm">
            <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
            No hay plantillas registradas
          </div>
        )}

        {!isLoading && plantillas.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Versión</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="text-right">Materiales</TableHead>
                <TableHead className="text-right">M.O.</TableHead>
                <TableHead className="text-right">Indirectos</TableHead>
                <TableHead className="text-right">Margen</TableHead>
                <TableHead className="text-right">Precio sug.</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plantillas.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">v{p.version}</TableCell>
                  <TableCell className="max-w-[180px] truncate" title={p.nombre}>
                    {p.nombre}
                  </TableCell>
                  <TableCell className="text-right">{fmt(p.costoMateriales)}</TableCell>
                  <TableCell className="text-right">{fmt(p.costoManoObra)}</TableCell>
                  <TableCell className="text-right">{fmt(p.costoIndirectos)}</TableCell>
                  <TableCell className="text-right">{(p.margenObjetivo * 100).toFixed(0)}%</TableCell>
                  <TableCell className="text-right font-medium">{fmt(p.precioSugerido)}</TableCell>
                  <TableCell>
                    {p.esActiva ? (
                      <Badge className="bg-green-600">Activa</Badge>
                    ) : (
                      <Badge variant="secondary">Inactiva</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {!p.esActiva && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleActivar(p.id)}
                          title="Activar"
                        >
                          <Play className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setEditing(p)}
                        title="Editar"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {!p.esActiva && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-600"
                          onClick={() => handleEliminar(p.id)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Formularios */}
      <PlantillaForm
        open={formOpen}
        onOpenChange={setFormOpen}
        productoId={productoId}
        onSubmit={handleCreate as (data: PlantillaCostoInput | UpdatePlantillaInput) => Promise<void>}
        isSubmitting={isSubmitting}
      />
      <PlantillaForm
        open={Boolean(editing)}
        onOpenChange={() => setEditing(null)}
        plantilla={editing}
        productoId={productoId}
        onSubmit={handleUpdate as (data: PlantillaCostoInput | UpdatePlantillaInput) => Promise<void>}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
