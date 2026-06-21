'use client'

import { useEffect, useState } from 'react'
import { Lightbulb, Loader2, Check, X } from 'lucide-react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getSugerenciasPrecioAction,
  aplicarSugerenciaPrecioAction,
} from '@/features/ficha-costo/actions-sugerencias'
import type { SugerenciaPrecioItem } from '@/features/ficha-costo/actions-sugerencias'

/**
 * @description Tabla de sugerencias de precio. Muestra el precio sugerido
 *   calculado, el diff vs el precio actual, y permite aprobar/rechazar
 *   individualmente o en batch.
 */
export function SugerenciasPrecioTable() {
  const [items, setItems] = useState<SugerenciaPrecioItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{ updated: number; skipped: number } | null>(null)

  useEffect(() => {
    getSugerenciasPrecioAction({}).then((d) => {
      setItems(d)
      setIsLoading(false)
    })
  }, [])

  async function handleApply(ids: string[]) {
    setIsSubmitting(true)
    const res = await aplicarSugerenciaPrecioAction({ productoIds: ids })
    if (res.success) {
      setResult(res.data)
      setSelected(new Set())
    }
    setIsSubmitting(false)
  }

  if (result) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <p className="text-lg font-semibold">Precios actualizados</p>
          <p className="text-muted-foreground text-sm">
            {result.updated} productos actualizados
          </p>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />Sugerencias de Precio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4" />Sugerencias de Precio
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            No hay sugerencias disponibles
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelected(selected.size === items.length ? new Set() : new Set(items.map(i => i.productoId)))}
                    >
                      {selected.size === items.length ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                    </Button>
                  </TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">P. Actual</TableHead>
                  <TableHead className="text-right">P. Sugerido</TableHead>
                  <TableHead className="text-right">Diff</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.productoId}>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={selected.has(item.productoId) ? 'default' : 'outline'}
                        onClick={() => {
                          const next = new Set(selected)
                          next.has(item.productoId) ? next.delete(item.productoId) : next.add(item.productoId)
                          setSelected(next)
                        }}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{item.nombre}</div>
                      {item.codigoInterno && (
                        <div className="text-muted-foreground text-xs">{item.codigoInterno}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{item.precioVentaActual}</TableCell>
                    <TableCell className="text-right font-medium">{item.precioSugerido}</TableCell>
                    <TableCell className="text-right">
                      <Badge className={item.diffAbsoluto > 0 ? 'bg-green-600' : 'bg-red-600'}>
                        {item.diffAbsoluto > 0 ? '+' : ''}{item.diffPorcentaje.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApply([item.productoId])}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Aplicar'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {selected.size > 0 && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {selected.size} producto{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}
                </span>
                <Button
                  size="sm"
                  onClick={() => handleApply(Array.from(selected))}
                  disabled={isSubmitting}
                >
                  Aplicar a {selected.size} producto{selected.size !== 1 ? 's' : ''}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
