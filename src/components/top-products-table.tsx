"use client"

import * as React from "react"
import { ArrowUpDown } from "lucide-react"
import { useGetDashboardStatsQuery } from "@/lib/redux/services/dashboardApi"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

export function TopProductsTable() {
  const { data: dashboardStats, isLoading, error } = useGetDashboardStatsQuery()
  const [sortColumn, setSortColumn] = React.useState<string>("ventas")
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("desc")

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("desc")
    }
  }

  const sortedProducts = React.useMemo(() => {
    if (!dashboardStats?.productosMasVendidos) return []

    return [...dashboardStats.productosMasVendidos].sort((a, b) => {
      const aValue = a[sortColumn as keyof typeof a]
      const bValue = b[sortColumn as keyof typeof b]

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
      }

      return 0
    })
  }, [dashboardStats, sortColumn, sortDirection])

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Productos Más Vendidos</CardTitle>
          <CardDescription>Error al cargar productos. Intente nuevamente más tarde.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Productos Más Vendidos</CardTitle>
        <CardDescription>Los productos con mejor desempeño este mes</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("nombre")}
                  className="flex items-center gap-1 px-0 font-medium"
                >
                  Producto
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("ingresos")}
                  className="flex items-center gap-1 px-0 font-medium"
                >
                  Ingresos
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("ventas")}
                  className="flex items-center gap-1 px-0 font-medium"
                >
                  Ventas
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? // Skeleton loading state
                Array(5)
                  .fill(0)
                  .map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell>
                        <Skeleton className="h-5 w-[180px]" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-5 w-16 ml-auto" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-5 w-20 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
              : sortedProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.nombre}</TableCell>
                    <TableCell className="text-right">${product.ingresos.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span>{product.ventas.toLocaleString()}</span>
                        <Badge
                          variant="outline"
                          className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
                        >
                          ↑
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            {!isLoading && sortedProducts.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-6">
                  No se encontraron productos
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
