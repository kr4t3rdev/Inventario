'use client'

import { useEffect, useState } from 'react'
import { Loader2, ListChecks } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getListasPreciosProductoAction } from '../actions'

interface ListasPreciosProps {
  productoId: string
  className?: string
}

interface PrecioEnLista {
  lista: { id: string; nombre: string }
  precio: number
}

/**
 * @description Muestra los precios del producto en cada lista de precios
 *   del tenant. La edición se realiza en el módulo listas-precios; este
 *   componente es solo lectura para mantener la ficha de costo como
 *   vista de consulta.
 */
export function ListasPrecios({ productoId, className }: ListasPreciosProps) {
  const [items, setItems] = useState<PrecioEnLista[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      const res = await getListasPreciosProductoAction({ productoId })
      if (cancelled) return
      if (!res.success) {
        setError(res.error?.message ?? 'Error desconocido')
        setItems([])
      } else {
        setItems(res.data)
      }
      setIsLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [productoId])

  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      <div className="flex items-center gap-2">
        <ListChecks className="text-muted-foreground h-4 w-4" aria-hidden="true" />
        <h3 className="text-sm font-medium">Precios en listas</h3>
      </div>

      <div className="rounded-lg border">
        {isLoading && (
          <div
            className="flex items-center justify-center py-6"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}
        {error && (
          <div role="alert" className="text-destructive bg-card p-3 text-sm">
            {error}
          </div>
        )}
        {!isLoading && !error && items.length === 0 && (
          <div className="text-muted-foreground p-6 text-center text-sm">
            Este producto no está incluido en ninguna lista de precios
          </div>
        )}
        {!isLoading && !error && items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lista</TableHead>
                <TableHead className="text-right">Precio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.lista.id}>
                  <TableCell>
                    <Badge variant="outline">{it.lista.nombre}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{it.precio}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
