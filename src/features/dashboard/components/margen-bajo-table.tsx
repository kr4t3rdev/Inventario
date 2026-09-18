'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getProductosMargenBajoAction } from '@/features/ficha-costo/actions-alertas'
import type { ProductoMargenBajoItem } from '@/features/ficha-costo/actions-alertas'

function getEstadoBadge(margen: number, estado: string) {
  if (estado === 'PERDIDA') return <Badge className="bg-red-600">🔴 {margen.toFixed(1)}%</Badge>
  if (estado === 'BAJO') return <Badge className="bg-yellow-600">🟡 {margen.toFixed(1)}%</Badge>
  return <Badge className="bg-green-600">🟢 {margen.toFixed(1)}%</Badge>
}

/**
 * @description Widget de dashboard que muestra los productos con margen
 *   por debajo del 10%. Se refresca automáticamente al montar.
 */
export function MargenBajoTable() {
  const [productos, setProductos] = useState<ProductoMargenBajoItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const result = await getProductosMargenBajoAction({ limit: 10 })
      setProductos(result.success ? (result.data ?? []) : [])
      setIsLoading(false)
    }
    load()
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            Productos con Margen Bajo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          Productos con Margen Bajo
        </CardTitle>
      </CardHeader>
      <CardContent>
        {productos.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            No hay productos con margen bajo
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">P. Venta</TableHead>
                <TableHead className="text-right">P. Costo</TableHead>
                <TableHead className="text-right">Margen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.nombre}</div>
                    {p.codigoInterno && (
                      <div className="text-muted-foreground text-xs">{p.codigoInterno}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{p.precioVenta}</TableCell>
                  <TableCell className="text-right">{p.precioCosto}</TableCell>
                  <TableCell className="text-right">
                    {getEstadoBadge(p.margenPorcentaje, p.estado)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
