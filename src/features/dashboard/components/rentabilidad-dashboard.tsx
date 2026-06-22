'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { getDashboardRentabilidadAction } from '@/features/ficha-costo/actions-alertas'
import type { DashboardRentabilidadData } from '@/features/ficha-costo/actions-alertas'

/**
 * @description Dashboard de rentabilidad: bar chart por categoría y
 *   top/bottom 5 productos por margen. Se refresca al montar.
 */
export function RentabilidadDashboard() {
  const [data, setData] = useState<DashboardRentabilidadData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    getDashboardRentabilidadAction({})
      .then((result) => {
        setData(result.success ? (result.data ?? null) : null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />Rentabilidad
        </CardTitle></CardHeader>
        <CardContent>
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 bg-muted animate-pulse rounded mb-2" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (!data || data.porCategoria.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />Rentabilidad
        </CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center py-4">
            No hay datos de rentabilidad disponibles
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Bar chart de categorías */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />Margen por Categoría
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.porCategoria.map((c) => (
              <div key={c.categoriaId} className="flex items-center gap-2">
                <div className="w-32 text-sm truncate" title={c.nombre}>{c.nombre}</div>
                <div className="flex-1">
                  <div className="h-6 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-violet-600 rounded transition-all"
                      style={{ width: `${Math.min(c.margenPromedio, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="w-20 text-right text-sm font-medium">
                  {c.margenPromedio.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top 5 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            Top 5 — Mayor Margen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Margen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topProductos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.nombre}</div>
                    <div className="text-muted-foreground text-xs">{p.categoria}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className="bg-green-600">{p.margenPorcentaje.toFixed(1)}%</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bottom 5 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-600" />
            Bottom 5 — Menor Margen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Margen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.bottomProductos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.nombre}</div>
                    <div className="text-muted-foreground text-xs">{p.categoria}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className={p.margenPorcentaje < MARGEN_UMBRAL ? 'bg-red-600' : 'bg-yellow-600'}>
                      {p.margenPorcentaje.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

const MARGEN_UMBRAL = 10
