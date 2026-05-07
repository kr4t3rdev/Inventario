"use client"
import { useGetProductosQuery } from "@/features/productos/api/productosApi"
import { useGetCategoriasQuery } from "@/features/categorias/api/categoriasApi"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileIcon as FilePdf, FileText } from "lucide-react"
import { exportToPdf, exportToCsv } from "@/lib/export-utils"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { StaggerContainer, StaggerItem, AnimatedCard } from "@/components/ui/animations"
import { cn } from "@/lib/utils"

const surfaceCardClass = cn(
  "relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl",
  "dark:border-slate-800/60 dark:bg-slate-900/10",
)

export function ReportePorCategoria() {
  const { data: productos, isLoading: isLoadingProductos } = useGetProductosQuery()
  const { data: categorias } = useGetCategoriasQuery()

  // Agrupar productos por categoría
  const productosPorCategoria = categorias?.map((categoria) => {
    const productosCategoria = productos?.filter((producto) => {
      return producto.categoria?.catId === categoria.catId || producto.categoriaId === categoria.catId
    }) || []


    const cantidadProductos = productosCategoria.length
    const valorTotal = productosCategoria.reduce((sum, producto) => sum + producto.precioCosto * producto.stock, 0)
    const valorVenta = productosCategoria.reduce((sum, producto) => sum + producto.precioVenta * producto.stock, 0)
    const stockTotal = productosCategoria.reduce((sum, producto) => sum + producto.stock, 0)

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

  // Colores vibrantes para mejor visibilidad
  const COLORS = ["#E53935", "#43A047", "#1E88E5", "#FB8C00", "#8E24AA", "#00ACC1", "#FF7043", "#5C6BC0"]

  // Custom Legend con colores prominentes
  const renderCustomLegend = ({ payload }: any) => {
    return (
      <ul className="space-y-2 mt-4">
        {payload.map((entry: any, index: number) => (
          <li key={`legend-${index}`} className="flex items-center gap-2 text-sm">
            <span
              className="w-4 h-4 rounded flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="font-medium text-gray-700">{entry.value}</span>
            <span className="text-gray-500 ml-auto">({((entry.payload.percent) * 100).toFixed(1)}%)</span>
          </li>
        ))}
      </ul>
    )
  }

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
      <StaggerItem className="flex justify-end gap-2">

        <Button variant="outline" size="sm" onClick={handleExportPdf}>
          <FilePdf className="mr-2 h-4 w-4" />
          PDF
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportCsv}>
          <FileText className="mr-2 h-4 w-4" />
          CSV
        </Button>
      </StaggerItem>

      <StaggerItem className="grid gap-4 md:grid-cols-2">
        <AnimatedCard>
        <Card className={surfaceCardClass}>
          <CardContent className="p-4">
            <h3 className="mb-4 text-lg font-medium">Distribución por Categoría</h3>
            {isLoadingProductos ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${Number(value).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`} />
                  <Legend content={renderCustomLegend} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        </AnimatedCard>

        <AnimatedCard>
        <Card className={surfaceCardClass}>
          <CardContent className="p-4">
            <h3 className="mb-4 text-lg font-medium">Resumen por Categoría</h3>
            {isLoadingProductos ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="rounded-md border">
                <Table >
                  <TableHeader className={surfaceCardClass}>
                    <TableRow>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Productos</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productosPorCategoria?.map((categoria) => (
                      <TableRow key={categoria.categoriaId}>
                        <TableCell className="font-medium">{categoria.nombre}</TableCell>
                        <TableCell className="text-right">{categoria.cantidadProductos}</TableCell>
                        <TableCell className="text-right">{categoria.stockTotal}</TableCell>
                        <TableCell className="text-right">${categoria.valorTotal.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                      <TableCell className="text-right">${categoria.valorTotal.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${categoria.valorVenta.toFixed(2)}</TableCell>
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