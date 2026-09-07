"use client"

import { useState, useMemo } from "react"
import { useProductos } from '@/features/productos/hooks/use-productos'
import { useCategorias } from "@/features/categorias/hooks/use-categorias"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ReportErrorState } from "./report-error-state"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { FileIcon as FilePdf, FileText, PieChart as PieChartIcon, Package } from "lucide-react"
import {  exportToPdf, exportToCsv } from "@/lib/export-utils"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { StaggerContainer, StaggerItem, AnimatedCard } from "@/components/ui/animations"
import { cn, formatCurrency } from "@/lib/utils"
import { getProductDisplayIdentifier } from "@/lib/product-display-utils"

const surfaceCardClass = cn(
  "relative overflow-hidden border-slate-200/60 shadow-sm backdrop-blur-xl",
  "dark:border-slate-800/20 dark:bg-slate-900/10",
)

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

export function ReporteGeneral() {
  const { productos, isLoading: isLoadingProductos, error: productosError } = useProductos()
  const { categorias, error: categoriasError } = useCategorias()
  const reportError = productosError ?? categoriasError
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Filtrar productos considerando que categorias puede estar cargando
  const productosFiltrados = useMemo(() => productos?.filter((producto) => {
    const productoCategoriaId = producto.categoria?.catId || producto.categoriaId
    return filtroCategoria === "todas" || productoCategoriaId === filtroCategoria
  }) || [], [productos, filtroCategoria])

  // Determinar si hay datos para mostrar
  const hasData = !isLoadingProductos && productos && productos.length > 0

  const getTotalStock = (producto: { stock?: number; stockTotal?: number }) =>
    producto.stockTotal ?? producto.stock ?? 0

  const totalProductos = productosFiltrados?.length || 0
  const valorTotal = productosFiltrados?.reduce((sum, producto) => sum + producto.precioCosto * getTotalStock(producto), 0) || 0
  const valorVenta = productosFiltrados?.reduce((sum, producto) => sum + producto.precioVenta * getTotalStock(producto), 0) || 0

  // Paginación
  const totalPages = Math.ceil(productosFiltrados.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const productosPaginados = productosFiltrados.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const valorPorCategoria = useMemo(() => {
    if (!productos || !categorias) return [];
    
    const map = new Map<string, number>();
    
    productos.forEach(p => {
      const catName = categorias.find(c => c.catId === p.categoriaId || c.catId === p.categoria?.catId)?.nombre || "Sin categoría";
      const valor = p.precioCosto * getTotalStock(p);
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
      Producto: getProductDisplayIdentifier(producto),
      Nombre: producto.nombre,
      Categoría: categorias?.find((c) => c.catId === producto.categoriaId || c.catId === producto.categoria?.catId)?.nombre || "Sin categoría",
      Stock: getTotalStock(producto),
      "Stock Mínimo": producto.stockMinimo > 0 ? producto.stockMinimo : "Por defecto (10)",
      "Precio Costo": producto.precioCosto,
      "Precio Venta": producto.precioVenta,
      "Valor Inventario": producto.precioCosto * getTotalStock(producto),
      "Valor Venta": producto.precioVenta * getTotalStock(producto),
    }))

    exportToPdf(data, null, "Reporte General de Inventario")
  }

  const handleExportCsv = () => {
    if (!productosFiltrados || productosFiltrados.length === 0) return

    const data = productosFiltrados.map((producto) => ({
      ID: producto.id,
      "Código Interno": producto.codigoInterno || "",
      Nombre: producto.nombre,
      Producto: getProductDisplayIdentifier(producto),
      Categoría: categorias?.find((c) => c.catId === producto.categoriaId || c.catId === producto.categoria?.catId)?.nombre || "",
      Stock: getTotalStock(producto),
      "Stock Mínimo": producto.stockMinimo > 0 ? producto.stockMinimo : "Por defecto (10)",
      "Estado Stock": (() => {
        const threshold = producto.stockMinimo > 0 ? producto.stockMinimo : 10
        if (getTotalStock(producto) === 0) return "Sin Stock"
        if (getTotalStock(producto) <= threshold) return "Stock Bajo"
        return "Stock Normal"
      })(),
      "Precio Costo": producto.precioCosto,
      "Precio Venta": producto.precioVenta,
      "Valor Inventario": producto.precioCosto * getTotalStock(producto),
      "Valor Venta": producto.precioVenta * getTotalStock(producto),
    }))

    exportToCsv(data, "Reporte_General_Inventario")
  }

  return (
    <StaggerContainer className="space-y-4">
      {reportError ? (
        <ReportErrorState
          title="No se pudo cargar el reporte de inventario"
          description="Revisa tu conexión a internet y vuelve a intentarlo."
          onRetry={() => window.location.reload()}
        />
      ) : null}

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
        <Card className={cn(surfaceCardClass)}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{totalProductos}</div>
                <p className="text-xs text-muted-foreground">Total de productos</p>
              </div>
              <Package className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        </AnimatedCard>
        
        <AnimatedCard>
        <Card className={cn(surfaceCardClass)}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{formatCurrency(valorTotal)}</div>
            <p className="text-xs text-muted-foreground">Valor de inventario (costo)</p>
          </CardContent>
        </Card>
        </AnimatedCard>
        
        <AnimatedCard>
        <Card className={cn(surfaceCardClass)}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{formatCurrency(valorVenta)}</div>
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
                        <Cell key={entry.name || `cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
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
                <Table className={surfaceCardClass}>
                  <TableHeader className="bg-muted/50">
                    <TableRow className={surfaceCardClass}>
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
                  <TableBody className={surfaceCardClass}>
                    {productosPaginados?.map((producto) => {
                      const categoriaNombre = categorias?.find((c) => c.catId === producto.categoriaId || c.catId === producto.categoria?.catId)?.nombre || "Sin categoría"
                      return (
                      <TableRow key={producto.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">{getProductDisplayIdentifier(producto)}</TableCell>
                        <TableCell>{categoriaNombre}</TableCell>
                        <TableCell className="text-right">
                          {(() => {
                            const threshold = producto.stockMinimo > 0 ? producto.stockMinimo : 10
                            let variant: "default" | "destructive" | "secondary" = "default"
                            
                            const totalStock = getTotalStock(producto)
                            if (totalStock === 0) {
                              variant = "destructive"
                            } else if (totalStock <= threshold) {
                              variant = "secondary"
                            }
                            
                            return <Badge variant={variant}>{totalStock}</Badge>
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          {producto.stockMinimo > 0 ? (
                            <Badge variant="outline">{producto.stockMinimo}</Badge>
                          ) : (
                            <Badge variant="secondary">Por defecto (10)</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(producto.precioCosto)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(producto.precioVenta)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(producto.precioCosto * getTotalStock(producto))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(producto.precioVenta * getTotalStock(producto))}</TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
        </AnimatedCard>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex flex-col items-center justify-between gap-4 border-t px-4 py-4 md:flex-row">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filas por página:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => handlePageSizeChange(Number(value))}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[5, 10, 20, 50].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <span>
                Página {currentPage} de {totalPages}
              </span>
              <span className="ml-2">
                ({startIndex + 1}-{Math.min(endIndex, productosFiltrados.length)} de {productosFiltrados.length})
              </span>
            </div>

            <Pagination className="justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    //disabled={currentPage === 1}
                  />
                </PaginationItem>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  const showPage = totalPages <= 7 || page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)
                  
                  if (!showPage && page === currentPage - 2) {
                    return (
                      <PaginationItem key="ellipsis-start">
                        <PaginationEllipsis />
                      </PaginationItem>
                    )
                  }
                  if (!showPage && page === currentPage + 2) {
                    return (
                      <PaginationItem key="ellipsis-end">
                        <PaginationEllipsis />
                      </PaginationItem>
                    )
                  }
                  
                  if (showPage) {
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => handlePageChange(page)}
                          isActive={currentPage === page}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  }
                  return null
                })}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    //disabled={currentPage === totalPages}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </StaggerItem>
    </StaggerContainer>
  )
}
