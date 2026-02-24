"use client"

import { useState, useMemo } from "react"
import { useGetProductosQuery } from "@/lib/redux/services/productosApi"
import { useGetCategoriasQuery } from "@/lib/redux/services/categoriasApi"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {  FileIcon as FilePdf, FileText, PieChart as PieChartIcon, Package } from "lucide-react"
import {  exportToPdf, exportToCsv } from "@/lib/export-utils"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { StaggerContainer, StaggerItem, AnimatedCard } from "@/components/ui/animations"
import { cn } from "@/lib/utils"

const surfaceCardClass = cn(
  "relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl",
  "dark:border-slate-800/60 dark:bg-slate-950/50",
)

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

export function ReporteGeneral() {
  const { data: productos, isLoading: isLoadingProductos } = useGetProductosQuery()
  const { data: categorias } = useGetCategoriasQuery()
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas")

  // Filtrar productos considerando que categorias puede estar cargando
  const productosFiltrados = useMemo(() => productos?.filter((producto) => {
    const productoCategoriaId = producto.categoria?.catId || producto.categoriaId
    return filtroCategoria === "todas" || productoCategoriaId === filtroCategoria
  }) || [], [productos, filtroCategoria])

  // Determinar si hay datos para mostrar
  const hasData = !isLoadingProductos && productos && productos.length > 0

  const totalProductos = productosFiltrados?.length || 0
  const valorTotal = productosFiltrados?.reduce((sum, producto) => sum + producto.precioCosto * producto.stock, 0) || 0
  const valorVenta = productosFiltrados?.reduce((sum, producto) => sum + producto.precioVenta * producto.stock, 0) || 0

  const valorPorCategoria = useMemo(() => {
    if (!productos || !categorias) return [];
    
    const map = new Map<string, number>();
    
    productos.forEach(p => {
      const catName = categorias.find(c => c.catId === p.categoriaId || c.catId === p.categoria?.catId)?.nombre || "Sin categoría";
      const valor = p.precioCosto * p.stock;
      map.set(catName, (map.get(catName) || 0) + valor);
    });
    
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 categories
  }, [productos, categorias]);

  const handleExportPdf = () => {
    if (!productosFiltrados || productosFiltrados.length === 0) return

    const data = productosFiltrados.map((producto) => ({
      Producto: producto.nombre,
      Categoría: categorias?.find((c) => c.catId === producto.categoriaId || c.catId === producto.categoria?.catId)?.nombre || "Sin categoría",
      Stock: producto.stock,
      "Stock Mínimo": producto.stockMinimo > 0 ? producto.stockMinimo : "Por defecto (10)",
      "Precio Costo": producto.precioCosto,
      "Precio Venta": producto.precioVenta,
      "Valor Inventario": producto.precioCosto * producto.stock,
      "Valor Venta": producto.precioVenta * producto.stock,
    }))

    exportToPdf(data, null, "Reporte General de Inventario")
  }

  const handleExportCsv = () => {
    if (!productosFiltrados || productosFiltrados.length === 0) return

    const data = productosFiltrados.map((producto) => ({
      ID: producto.id,
      Nombre: producto.nombre,
      Categoría: categorias?.find((c) => c.catId === producto.categoriaId || c.catId === producto.categoria?.catId)?.nombre || "",
      Stock: producto.stock,
      "Stock Mínimo": producto.stockMinimo > 0 ? producto.stockMinimo : "Por defecto (10)",
      "Estado Stock": (() => {
        const threshold = producto.stockMinimo > 0 ? producto.stockMinimo : 10
        if (producto.stock === 0) return "Sin Stock"
        if (producto.stock <= threshold) return "Stock Bajo"
        return "Stock Normal"
      })(),
      "Precio Costo": producto.precioCosto,
      "Precio Venta": producto.precioVenta,
      "Valor Inventario": producto.precioCosto * producto.stock,
      "Valor Venta": producto.precioVenta * producto.stock,
    }))

    exportToCsv(data, "Reporte_General_Inventario")
  }

  return (
    <StaggerContainer className="space-y-4">
      <StaggerItem className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las categorías</SelectItem>
              {categorias?.map((categoria) => (
                <SelectItem key={categoria.catId} value={categoria.catId}>
                  {categoria.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <FilePdf className="mr-2 h-4 w-4" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <FileText className="mr-2 h-4 w-4" />
            CSV
          </Button>
        </div>
      </StaggerItem>

      <StaggerItem className="grid gap-4 md:grid-cols-3">
        <AnimatedCard>
        <Card className={cn(surfaceCardClass, "border-l-4 border-l-blue-500")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{totalProductos}</div>
                <p className="text-xs text-muted-foreground">Total de productos</p>
              </div>
              <Package className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        </AnimatedCard>
        
        <AnimatedCard>
        <Card className={cn(surfaceCardClass, "border-l-4 border-l-emerald-500")}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">${valorTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">Valor de inventario (costo)</p>
          </CardContent>
        </Card>
        </AnimatedCard>
        
        <AnimatedCard>
        <Card className={cn(surfaceCardClass, "border-l-4 border-l-purple-500")}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">${valorVenta.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">Valor de inventario (venta)</p>
          </CardContent>
        </Card>
        </AnimatedCard>
      </StaggerItem>

      {/* Chart Section */}
      <StaggerItem>
        <AnimatedCard>
          <Card className={surfaceCardClass}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5" />
                Valor de Inventario por Categoría
              </CardTitle>
              <CardDescription>
                Distribución del valor (costo) de los productos por categoría (Top 10)
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              {valorPorCategoria.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={valorPorCategoria}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {valorPorCategoria.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  No hay datos suficientes para mostrar el gráfico
                </div>
              )}
            </CardContent>
          </Card>
        </AnimatedCard>
      </StaggerItem>

      <StaggerItem>
        <AnimatedCard>
        <Card className={surfaceCardClass}>
          <CardContent className="p-0">
            <div className="rounded-md border-0">
              {!hasData ? (
                <div className="p-8 text-center text-muted-foreground">
                  {isLoadingProductos ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : (
                    <p>No hay productos disponibles</p>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Stock Mínimo</TableHead>
                      <TableHead className="text-right">Precio Costo</TableHead>
                      <TableHead className="text-right">Precio Venta</TableHead>
                      <TableHead className="text-right">Valor Inventario</TableHead>
                      <TableHead className="text-right">Valor Venta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productosFiltrados?.map((producto) => {
                      const categoriaNombre = categorias?.find((c) => c.catId === producto.categoriaId || c.catId === producto.categoria?.catId)?.nombre || "Sin categoría"
                      return (
                      <TableRow key={producto.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">{producto.nombre}</TableCell>
                        <TableCell>{categoriaNombre}</TableCell>
                        <TableCell className="text-right">
                          {(() => {
                            const threshold = producto.stockMinimo > 0 ? producto.stockMinimo : 10
                            let variant: "default" | "destructive" | "secondary" = "default"
                            
                            if (producto.stock === 0) {
                              variant = "destructive"
                            } else if (producto.stock <= threshold) {
                              variant = "secondary"
                            }
                            
                            return <Badge variant={variant}>{producto.stock}</Badge>
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          {producto.stockMinimo > 0 ? (
                            <Badge variant="outline">{producto.stockMinimo}</Badge>
                          ) : (
                            <Badge variant="secondary">Por defecto (10)</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">${producto.precioCosto.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">${producto.precioVenta.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">${(producto.precioCosto * producto.stock).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">${(producto.precioVenta * producto.stock).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
        </AnimatedCard>
      </StaggerItem>
    </StaggerContainer>
  )
}
