"use client"

import { useState } from "react"
import { useGetStockPorUbicacionQuery } from "@/lib/redux/services/stockUbicacionApi"
import { useGetAlmacenesQuery } from "@/lib/redux/services/almacenesApi"
import { useGetPuntosDeVentaQuery } from "@/lib/redux/services/puntosDeVentaApi"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { FileIcon as FilePdf, FileText, Warehouse, Store } from "lucide-react"
import { exportToPdf, exportToCsv } from "@/lib/export-utils"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { StaggerContainer, StaggerItem, AnimatedCard } from "@/components/ui/animations"
import { cn } from "@/lib/utils"

const surfaceCardClass = cn(
  "relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl",
  "dark:border-slate-800/60 dark:bg-slate-900/10",
)

export function ReportePorUbicacion() {
  const [ubicacionId, setUbicacionId] = useState<string>("")
  const [tipoUbicacion, setTipoUbicacion] = useState<"almacen" | "punto_venta">("almacen")

  const { data: almacenes } = useGetAlmacenesQuery()
  const { data: puntosVenta } = useGetPuntosDeVentaQuery()
  const {
    data: productosUbicacion,
    isLoading: isLoadingProductosUbicacion,
    isError,
    error,
  } = useGetStockPorUbicacionQuery(
    { ubicacionId, tipoUbicacion, includeZero: true },
    { skip: !ubicacionId },
  )

  const handleUbicacionChange = (value: string) => {
    const [tipo, id] = value.split(":")
    setTipoUbicacion(tipo as "almacen" | "punto_venta")
    setUbicacionId(id)
  }

  const chartData = productosUbicacion
    ?.filter((p) => p.stockUbicacion > 0)
    .slice(0, 10)
    .map((p) => ({
      name: p.nombre.length > 15 ? p.nombre.substring(0, 15) + "..." : p.nombre,
      stock: p.stockUbicacion,
      valor: p.stockUbicacion * p.precioCosto,
    }))

  const nombreUbicacion =
    tipoUbicacion === "almacen"
      ? almacenes?.find((a) => a.almacenId === ubicacionId)?.nombre
      : puntosVenta?.find((p) => p.pvId === ubicacionId)?.nombre

  const handleExportPdf = () => {
    if (!productosUbicacion) return
    exportToPdf(
      productosUbicacion,
      null,
      `Inventario en ${tipoUbicacion === "almacen" ? "Almacén" : "Punto de Venta"}: ${nombreUbicacion}`,
    )
  }

  const handleExportCsv = () => {
    if (!productosUbicacion) return

    const data = productosUbicacion.map((producto) => ({
      ID: producto.id,
      Nombre: producto.nombre,
      Categoria: (producto as any)?.categoria?.nombre ?? "",
      Subcategoria: (producto as any)?.subcategoria?.nombre ?? "",
      "Stock en Ubicación": producto.stockUbicacion,
      "Precio Costo": producto.precioCosto,
      "Valor en Ubicación": producto.stockUbicacion * producto.precioCosto,
    }))

    exportToCsv(data, `Inventario_${nombreUbicacion}`)
  }

  return (
    <StaggerContainer className="space-y-4">
      <StaggerItem className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Select value={`${tipoUbicacion}:${ubicacionId}`} onValueChange={handleUbicacionChange}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Selecciona una ubicación" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Almacenes</SelectLabel>
                {almacenes?.map((almacen) => (
                  <SelectItem key={almacen.almacenId} value={`almacen:${almacen.almacenId}`}>
                    <div className="flex items-center">
                      <Warehouse className="mr-2 h-4 w-4" />
                      {almacen.nombre}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Puntos de Venta</SelectLabel>
                {puntosVenta?.map((punto) => (
                  <SelectItem key={punto.pvId} value={`punto_venta:${punto.pvId}`}>
                    <div className="flex items-center">
                      <Store className="mr-2 h-4 w-4" />
                      {punto.nombre}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={!ubicacionId}>
            <FilePdf className="mr-2 h-4 w-4" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!ubicacionId}>
            <FileText className="mr-2 h-4 w-4" />
            CSV
          </Button>
        </div>
      </StaggerItem>

      {!ubicacionId ? (
        <StaggerItem>
          <div>
            <div className="flex h-[400px] items-center justify-center rounded-md border border-dashed">
              <div className="text-center">
                <h3 className="text-lg font-medium">Selecciona una ubicación</h3>
                <p className="text-sm text-muted-foreground">Elige un almacén o punto de venta para ver su inventario</p>
              </div>
            </div>
          </div>
        </StaggerItem>
      ) : isError ? (
        <StaggerItem>
          <div>
            <div className="flex h-[400px] items-center justify-center rounded-md border border-dashed border-destructive/30 bg-destructive/10">
              <div className="text-center text-destructive">
                <h3 className="text-lg font-medium">Error al cargar datos</h3>
                <p className="text-sm">
                  No se pudo obtener el inventario de la ubicación seleccionada.
                  <br />
                  {JSON.stringify(error)}
                </p>
              </div>
            </div>
          </div>
        </StaggerItem>
      ) : isLoadingProductosUbicacion ? (
        <StaggerItem>
          <Skeleton className="h-[400px] w-full" />
        </StaggerItem>
      ) : (
        <StaggerItem className="grid gap-4 md:grid-cols-3">
          <AnimatedCard>
            <Card className={cn(surfaceCardClass, "border-l-4 border-l-primary")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">
                  {productosUbicacion?.filter((p) => p.stockUbicacion > 0).length || 0}
                </div>
                <p className="text-xs text-muted-foreground">Productos en ubicación</p>
              </CardContent>
            </Card>
          </AnimatedCard>
          <AnimatedCard>
            <Card className={cn(surfaceCardClass, "border-l-4 border-l-chart-2")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">
                  {productosUbicacion?.reduce((sum, p) => sum + p.stockUbicacion, 0) || 0}
                </div>
                <p className="text-xs text-muted-foreground">Unidades totales</p>
              </CardContent>
            </Card>
          </AnimatedCard>
          <AnimatedCard>
            <Card className={cn(surfaceCardClass, "border-l-4 border-l-accent")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">
                  $
                  {productosUbicacion?.reduce((sum, p) => sum + p.stockUbicacion * p.precioCosto, 0) ||
                    "0.00"}
                </div>
                <p className="text-xs text-muted-foreground">Valor del inventario</p>
              </CardContent>
            </Card>
          </AnimatedCard>
        </StaggerItem>
      )}

      {ubicacionId && !isError && !isLoadingProductosUbicacion && (
        <>
          <StaggerItem>
            <AnimatedCard>
              <Card className={surfaceCardClass}>
                <CardContent className="p-4">
                  <h3 className="mb-4 text-lg font-medium">Top 10 Productos por Stock</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip
                        formatter={(value, name) => [
                          name === 'stock' ? value : `${Number(value)}`,
                          name === "Stock" ? 'Stock' : 'Valor ($)',
                        ]}
                      />
                      <Legend />
                      <Bar dataKey="stock" name="Stock" fill="#8884d8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="valor" name="Valor ($)" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </AnimatedCard>
          </StaggerItem>

          <StaggerItem>
            <AnimatedCard>
              <Card className={surfaceCardClass}>
                <CardContent className="p-0">
                  <div className="rounded-md border-0">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead>Categoría</TableHead>
                          <TableHead>Subcategoría</TableHead>
                          <TableHead className="text-right">Stock en Ubicación</TableHead>
                          <TableHead className="text-right">Precio Costo</TableHead>
                          <TableHead className="text-right">Valor en Ubicación</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {productosUbicacion && productosUbicacion.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              No hay productos con stock en esta ubicación
                            </TableCell>
                          </TableRow>
                        ) : (
                          productosUbicacion?.map((producto) => (
                            <TableRow key={producto.id} className="hover:bg-muted/50 transition-colors">
                              <TableCell className="font-medium">{producto.nombre}</TableCell>
                              <TableCell>{(producto as any)?.categoria?.nombre ?? '-'}</TableCell>
                              <TableCell>{(producto as any)?.subcategoria?.nombre ?? '-'}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant={producto.stockUbicacion > 5 ? "default" : "destructive"}>
                                  {producto.stockUbicacion}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">${producto.precioCosto}</TableCell>
                              <TableCell className="text-right">
                                ${(producto.stockUbicacion * producto.precioCosto)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </AnimatedCard>
          </StaggerItem>
        </>
      )}
    </StaggerContainer>
  )
}
