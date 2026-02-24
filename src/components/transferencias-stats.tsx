"use client"
import { ArrowRightLeft, Warehouse, Store } from "lucide-react"
import { useGetDashboardStatsQuery } from "@/lib/redux/services/dashboardApi"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

export function TransferenciasStats() {
  const { data: dashboardStats, isLoading, error } = useGetDashboardStatsQuery()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Estadísticas de Transferencias</CardTitle>
          <CardDescription>Movimientos entre ubicaciones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !dashboardStats?.transferenciasStats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Estadísticas de Transferencias</CardTitle>
          <CardDescription>Error al cargar datos</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { transferenciasStats } = dashboardStats
  const total = Object.values(transferenciasStats).reduce((sum, count) => sum + count, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-indigo-600" />
          Estadísticas de Transferencias
        </CardTitle>
        <CardDescription>Distribución de movimientos entre ubicaciones ({total} total)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Almacén a Almacén */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Warehouse className="h-4 w-4 text-blue-600" />
                <ArrowRightLeft className="h-3 w-3 text-blue-600" />
                <Warehouse className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Almacén → Almacén</p>
                <p className="text-xs text-blue-700 dark:text-blue-300">Entre almacenes</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200">
              {transferenciasStats.almacenAAlmacen}
            </Badge>
          </div>

          {/* Almacén a Punto de Venta */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Warehouse className="h-4 w-4 text-green-600" />
                <ArrowRightLeft className="h-3 w-3 text-green-600" />
                <Store className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-900 dark:text-green-100">Almacén → Tienda</p>
                <p className="text-xs text-green-700 dark:text-green-300">Distribución a ventas</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200">
              {transferenciasStats.almacenAPuntoVenta}
            </Badge>
          </div>

          {/* Punto de Venta a Almacén */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Store className="h-4 w-4 text-orange-600" />
                <ArrowRightLeft className="h-3 w-3 text-orange-600" />
                <Warehouse className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-orange-900 dark:text-orange-100">Tienda → Almacén</p>
                <p className="text-xs text-orange-700 dark:text-orange-300">Devoluciones</p>
              </div>
            </div>
            <Badge
              variant="secondary"
              className="bg-orange-200 text-orange-800 dark:bg-orange-800 dark:text-orange-200"
            >
              {transferenciasStats.puntoVentaAAlmacen}
            </Badge>
          </div>

          {/* Punto de Venta a Punto de Venta */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Store className="h-4 w-4 text-purple-600" />
                <ArrowRightLeft className="h-3 w-3 text-purple-600" />
                <Store className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-purple-900 dark:text-purple-100">Tienda → Tienda</p>
                <p className="text-xs text-purple-700 dark:text-purple-300">Entre sucursales</p>
              </div>
            </div>
            <Badge
              variant="secondary"
              className="bg-purple-200 text-purple-800 dark:bg-purple-800 dark:text-purple-200"
            >
              {transferenciasStats.puntoVentaAPuntoVenta}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
