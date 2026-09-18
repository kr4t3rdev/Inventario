"use client"
import { useProductos } from '@/features/productos/hooks/use-productos'
import { useCategorias } from "@/features/categorias/hooks/use-categorias"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileIcon as FilePdf, FileText, AlertTriangle, Info } from "lucide-react"
import { exportToPdf, exportToCsv } from "@/lib/export-utils"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { StaggerContainer, StaggerItem, AnimatedCard } from "@/components/ui/animations"
import { ReportErrorState } from "./report-error-state"
import { CategoryLegend } from "./category-legend"
import { formatCurrency } from "@/lib/utils"


import { SURFACE_CARD_CLASS, CHART_COLORS } from "@/features/reportes-financieros/lib/reporte-styles"
import { deriveCategoryInsights } from "@/features/reportes-financieros/lib/category-insights"

export function ReportePorCategoria() {
  const { productos, isLoading: isLoadingProductos, error: productosError } = useProductos()
  const { categorias, error: categoriasError } = useCategorias()
  const reportError = productosError ?? categoriasError
  const getTotalStock = (producto: { stock?: number; stockTotal?: number }) =>
    producto.stockTotal ?? producto.stock ?? 0

  // Agrupar productos por categoría
  const productosPorCategoria = categorias?.map((categoria) => {
    const productosCategoria = productos?.filter((producto) => {
      return producto.categoria?.catId === categoria.catId || producto.categoriaId === categoria.catId
    }) || []


    const cantidadProductos = productosCategoria.length
    const valorTotal = productosCategoria.reduce((sum, producto) => sum + producto.precioCosto * getTotalStock(producto), 0)
    const valorVenta = productosCategoria.reduce((sum, producto) => sum + producto.precioVenta * getTotalStock(producto), 0)
    const stockTotal = productosCategoria.reduce((sum, producto) => sum + getTotalStock(producto), 0)

    return {
      categoriaId: categoria.catId,
      nombre: categoria.nombre,
      cantidadProductos,
      stockTotal,
      valorTotal,
      valorVenta,
    }
  })

  // Mostrar resumen final
  // console.log('\n=== RESUMEN FINAL ===')
  // console.log('Productos por categoría:', productosPorCategoria?.map(p => ({ nombre: p.nombre, cantidad: p.cantidadProductos })))

  // Datos para el gráfico (filtrar valores 0)
  const chartData = productosPorCategoria
    ?.map((cat) => ({
      name: cat.nombre,
      value: cat.valorTotal,
      percent: 0,
    }))
    .filter((item) => item.value > 0)

  // Calcular porcentajes
  const total = chartData?.reduce((sum, item) => sum + item.value, 0) || 0
  chartData?.forEach((item) => {
    item.percent = total > 0 ? item.value / total : 0
  })

  // Paleta compartida del módulo (tokens de tema, soportan modo oscuro)
  const COLORS = [...CHART_COLORS]

  // Productos bajo stock mínimo por categoría (misma regla que reporte-general)
  const quiebresPorCategoria = new Map<string, number>();
  productos?.forEach((producto) => {
    const total = getTotalStock(producto);
    const minimo = producto.stockMinimo > 0 ? producto.stockMinimo : 10;
    if (total <= minimo) {
      const catId = producto.categoria?.catId ?? producto.categoriaId;
      if (catId) quiebresPorCategoria.set(catId, (quiebresPorCategoria.get(catId) ?? 0) + 1);
    }
  });
  const insights = deriveCategoryInsights(productosPorCategoria ?? [], quiebresPorCategoria);

  // const handleExportExcel = () => {
  //   if (!productosPorCategoria) return
  //   exportToExcel(productosPorCategoria, "Reporte_Por_Categoria")
  // }

  const handleExportPdf = () => {
    if (!productosPorCategoria) return
    exportToPdf(productosPorCategoria, null, "Reporte Por Categoría")
  }

  const handleExportCsv = () => {
    if (!productosPorCategoria) return
    exportToCsv(productosPorCategoria, "Reporte_Por_Categoria")
  }



  return (
    <StaggerContainer className="space-y-4">
      {reportError ? (
        <ReportErrorState
          title="No se pudo cargar el reporte por categoría"
          description="Revisa tu conexión a internet y vuelve a intentarlo."
          onRetry={() => window.location.reload()}
        />
      ) : null}

      <StaggerItem className="flex justify-end gap-2">

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPdf}
          disabled={!productosPorCategoria || productosPorCategoria.length === 0}
        >
          <FilePdf className="mr-2 h-4 w-4" />
          PDF
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          disabled={!productosPorCategoria || productosPorCategoria.length === 0}
        >
          <FileText className="mr-2 h-4 w-4" />
          CSV
        </Button>
      </StaggerItem>

      <StaggerItem className="grid gap-4 md:grid-cols-2">
        <AnimatedCard>
        <Card className={SURFACE_CARD_CLASS}>
          <CardContent className="p-4">
            <h3 className="mb-4 text-lg font-medium">Distribución por Categoría</h3>
            {isLoadingProductos ? (
              <Skeleton className="h-[400px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill={CHART_COLORS[0]}
                    dataKey="value"
                  >
                    {chartData?.map((entry, index) => (
                      <Cell key={entry.name || `cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend content={<CategoryLegend />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        </AnimatedCard>

        <AnimatedCard>
        <Card className={SURFACE_CARD_CLASS}>
          <CardContent className="p-4">
            <h3 className="mb-1 text-lg font-medium">Lectura rápida</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Síntesis automática de la distribución por categoría
            </p>
            {isLoadingProductos ? (
              <Skeleton className="h-[300px] w-full" />
            ) : insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay datos suficientes para generar insights.
              </p>
            ) : (
              <ul className="space-y-3">
                {insights.map((insight) => (
                  <li key={insight.id} className="flex items-start gap-3 rounded-md border p-3">
                    <span
                      className={insight.tono === 'alerta' ? 'mt-0.5 text-amber-600' : 'mt-0.5 text-muted-foreground'}
                      aria-hidden="true"
                    >
                      {insight.tono === 'alerta' ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : (
                        <Info className="h-4 w-4" />
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{insight.titulo}</p>
                      <p className="text-xs text-muted-foreground">{insight.detalle}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        </AnimatedCard>
      </StaggerItem>

      <StaggerItem>
        <AnimatedCard>
        <Card className={SURFACE_CARD_CLASS}>
          <CardContent className="p-0">
              <div className="overflow-x-auto rounded-md border-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Cantidad Productos</TableHead>
                    <TableHead className="text-right">Stock Total</TableHead>
                    <TableHead className="text-right">Valor Inventario</TableHead>
                    <TableHead className="text-right">Valor Venta</TableHead>
                    <TableHead className="text-right">Margen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productosPorCategoria?.map((categoria) => (
                    <TableRow key={categoria.categoriaId} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">{categoria.nombre}</TableCell>
                      <TableCell className="text-right">{categoria.cantidadProductos}</TableCell>
                      <TableCell className="text-right">{categoria.stockTotal}</TableCell>
                      <TableCell className="text-right">{formatCurrency(categoria.valorTotal)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(categoria.valorVenta)}</TableCell>
                      <TableCell className="text-right">
                        {categoria.valorTotal > 0
                          ? `${(((categoria.valorVenta - categoria.valorTotal) / categoria.valorTotal) * 100).toFixed(2)}%`
                          : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        </AnimatedCard>
      </StaggerItem>
    </StaggerContainer>
  )
}
