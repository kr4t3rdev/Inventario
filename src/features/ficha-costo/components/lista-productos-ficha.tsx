'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Search, Loader2, Receipt } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  listarProductosParaFichaAction,
  type ProductoFichaListItem,
} from '../actions'

/**
 * @description Selector de productos para la página principal de Ficha
 *   de Costo. Lista productos con búsqueda por nombre/código y un
 *   enlace directo a la ficha de cada uno.
 */
export function ListaProductosFicha() {
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<ProductoFichaListItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      const res = await listarProductosParaFichaAction({ search })
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
  }, [search])

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search
          className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={search}
          onChange={(e) => {
            startTransition(() => setSearch(e.target.value))
          }}
          placeholder="Buscar por nombre o código…"
          className="pl-9"
          aria-label="Buscar producto"
        />
      </div>

      <div className="text-muted-foreground text-sm" role="status" aria-live="polite">
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Buscando…
          </span>
        ) : (
          <span>
            {items.length} producto{items.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {error && (
        <div role="alert" className="text-destructive text-sm">
          {error}
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            No se encontraron productos con el criterio de búsqueda.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((it) => (
          <Card
            key={it.id}
            className="hover:border-primary/50 transition-colors"
            data-testid={`producto-card-${it.id}`}
          >
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold leading-tight">{it.nombre}</p>
                  <p className="text-muted-foreground text-xs">
                    {it.codigoInterno ?? 'sin código'}
                  </p>
                </div>
                <Badge variant={it.tipo === 'COMPUESTO' ? 'default' : 'secondary'}>
                  {it.tipo === 'COMPUESTO' ? 'Compuesto' : 'Simple'}
                </Badge>
              </div>

              <dl className="text-muted-foreground grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="uppercase">Costo</dt>
                  <dd className="text-foreground text-sm font-medium">
                    {it.precioCosto}
                  </dd>
                </div>
                <div>
                  <dt className="uppercase">Venta</dt>
                  <dd className="text-foreground text-sm font-medium">
                    {it.precioVenta}
                  </dd>
                </div>
              </dl>

              <Button asChild variant="outline" size="sm" className="w-full gap-2">
                <Link href={`/busy/ficha-costo/${it.id}`}>
                  <Receipt className="h-4 w-4" />
                  Ver ficha
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
