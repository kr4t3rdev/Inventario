"use client"

import { useMemo, useState, useEffect } from "react"
import { useVentas } from "@/features/ventas/hooks/use-ventas"
import { useGetMermasQuery } from "@/features/mermas/api/mermasApi"
import { useGetTransferenciasQuery } from "@/features/transferencias/api/transferenciasApi"
import { getProductosAction } from "@/features/productos"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { FileIcon as FilePdf, FileText } from "lucide-react"
import { exportToPdf, exportToCsv } from "@/lib/export-utils"
import { flattenVentas } from "@/lib/ventas-utils"
import { format } from "date-fns"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { StaggerContainer, StaggerItem, AnimatedCard } from "@/components/ui/animations"
import { cn } from "@/lib/utils"
import { getProductDisplayIdentifier } from "@/lib/product-display-utils"

const surfaceCardClass = cn(
  "relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl",
  "dark:border-slate-800/60 dark:bg-slate-900/10",
)

export function ReporteMovimientos() {
  const [tipoMovimiento, setTipoMovimiento] = useState<string>("ventas")
  const [productoId, setProductoId] = useState<string>("todos")
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    to: new Date(),
  })

  const { ventas, isLoading: isLoadingVentas } = useVentas()
  const { data: mermas, isLoading: isLoadingMermas } = useGetMermasQuery()
  const { data: transferenciasData, isLoading: isLoadingTransferencias } = useGetTransferenciasQuery()
  const transferencias = transferenciasData?.transferencias || []
  const [productos, setProductos] = useState<any[]>([])
  const [isLoadingProductos, setIsLoadingProductos] = useState(true)

  useEffect(() => {
    getProductosAction().then(r => {
      if (r.success) setProductos(r.data ?? [])
      setIsLoadingProductos(false)
    })
  }, [])

  const getProductoById = (id: string) => productos?.find((producto) => producto.id === id)

  // Filtrar movimientos por fecha y producto
  const filtrarPorFecha = (fecha: string) => {
    const fechaObj = new Date(fecha)
    return fechaObj >= dateRange.from && fechaObj <= dateRange.to
  }

  const ventasLineas = useMemo(() => flattenVentas(ventas), [ventas])

  const ventasFiltradas = ventasLineas.filter(
    (venta) => filtrarPorFecha(venta.createdAt) && (productoId === "todos" || venta.productoId === productoId),
  )

  const mermasFiltradas = mermas?.filter(
    (merma) => filtrarPorFecha(merma.createdAt) && (productoId === "todos" || merma.productoId === productoId),
  )

  const transferenciasFiltradas = transferencias?.filter(
    (transferencia) =>
      filtrarPorFecha(transferencia.createdAt) && (productoId === "todos" || transferencia.productoId === productoId),
  )

  // Datos para el gráfico
  const prepararDatosGrafico = () => {
    const fechaInicio = dateRange.from
    const fechaFin = dateRange.to
    const diasDiferencia = Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 3600 * 24))

    // Si el rango es mayor a 31 días, agrupar por semana
    const agruparPorSemana = diasDiferencia > 31

    const datos: Record<string, { fecha: string; cantidad: number }> = {}

    if (tipoMovimiento === "ventas" && ventasFiltradas) {
      ventasFiltradas.forEach((venta) => {
        const fecha = new Date(venta.createdAt)
        let clave

        if (agruparPorSemana) {
          // Obtener el primer día de la semana (lunes)
          const diaSemana = fecha.getDay() || 7
          const primerDiaSemana = new Date(fecha)
          primerDiaSemana.setDate(fecha.getDate() - diaSemana + 1)
          clave = format(primerDiaSemana, "yyyy-MM-dd")
        } else {
          clave = format(fecha, "yyyy-MM-dd")
        }

        if (!datos[clave]) {
          datos[clave] = { fecha: clave, cantidad: 0 }
        }
        datos[clave].cantidad += venta.cantidad
      })
    } else if (tipoMovimiento === "mermas" && mermasFiltradas) {
      mermasFiltradas.forEach((merma) => {
        const fecha = new Date(merma.createdAt)
        let clave

        if (agruparPorSemana) {
          const diaSemana = fecha.getDay() || 7
          const primerDiaSemana = new Date(fecha)
          primerDiaSemana.setDate(fecha.getDate() - diaSemana + 1)
          clave = format(primerDiaSemana, "yyyy-MM-dd")
        } else {
          clave = format(fecha, "yyyy-MM-dd")
        }

        if (!datos[clave]) {
          datos[clave] = { fecha: clave, cantidad: 0 }
        }
        datos[clave].cantidad += merma.cantidad
      })
    } else if (tipoMovimiento === "transferencias" && transferenciasFiltradas) {
      transferenciasFiltradas.forEach((transferencia) => {
        const fecha = new Date(transferencia.createdAt)
        let clave

        if (agruparPorSemana) {
          const diaSemana = fecha.getDay() || 7
          const primerDiaSemana = new Date(fecha)
          primerDiaSemana.setDate(fecha.getDate() - diaSemana + 1)
          clave = format(primerDiaSemana, "yyyy-MM-dd")
        } else {
          clave = format(fecha, "yyyy-MM-dd")
        }

        if (!datos[clave]) {
          datos[clave] = { fecha: clave, cantidad: 0 }
        }
        datos[clave].cantidad += transferencia.cantidad
      })
    }

    return Object.values(datos).sort((a, b) => a.fecha.localeCompare(b.fecha))
  }

  const chartData = prepararDatosGrafico()

  const handleExportPdf = () => {
    let data: any[] = []
    let title = ""

    if (tipoMovimiento === "ventas" && ventasFiltradas) {
      data = ventasFiltradas
      title = "Reporte de Ventas"
    } else if (tipoMovimiento === "mermas" && mermasFiltradas) {
      data = mermasFiltradas
      title = "Reporte de Mermas"
    } else if (tipoMovimiento === "transferencias" && transferenciasFiltradas) {
      data = transferenciasFiltradas
      title = "Reporte de Transferencias"
    }

    if (data.length > 0) {
      exportToPdf(data, productos ?? null, title)
    }
  }

  const handleExportCsv = () => {
    let data: any[] = []
    let filename = ""

    if (tipoMovimiento === "ventas" && ventasFiltradas) {
      data = ventasFiltradas.map((venta) => ({
        ID: venta.ventaId,
        Producto: getProductDisplayIdentifier({
          id: venta.productoId,
          nombre: venta.producto?.nombre || venta.productoNombre,
          codigoInterno: venta.producto?.codigoInterno || venta.productoCodigoInterno,
        }),
        Cantidad: venta.cantidad,
        Fecha: format(new Date(venta.createdAt), "dd/MM/yyyy"),
        "Punto de Venta": venta.puntoDeVenta?.nombre,
      }))
      filename = "Reporte_Ventas"
    } else if (tipoMovimiento === "mermas" && mermasFiltradas) {
      data = mermasFiltradas.map((merma) => ({
        ID: merma.mermaId,
        Producto: getProductDisplayIdentifier({
          id: merma.productoId,
          nombre: getProductoById(merma.productoId)?.nombre || merma.producto?.nombre,
          codigoInterno:
            getProductoById(merma.productoId)?.codigoInterno || merma.producto?.codigoInterno,
        }),
        Cantidad: merma.cantidad,
        Fecha: format(new Date(merma.createdAt), "dd/MM/yyyy"),
        Motivo: merma.motivo,
      }))
      filename = "Reporte_Mermas"
    } else if (tipoMovimiento === "transferencias" && transferenciasFiltradas) {
      data = transferenciasFiltradas.map((transferencia) => ({
        ID: transferencia.transferenciaId,
        Producto: getProductDisplayIdentifier({
          id: transferencia.productoId,
          nombre: getProductoById(transferencia.productoId)?.nombre || transferencia.producto?.nombre,
          codigoInterno:
            transferencia.productoCodigoInterno ||
            getProductoById(transferencia.productoId)?.codigoInterno ||
            transferencia.producto?.codigoInterno,
        }),
        Cantidad: transferencia.cantidad,
        Fecha: format(new Date(transferencia.createdAt), "dd/MM/yyyy"),
        Origen: transferencia.origenNombre || transferencia.origen?.nombre || "N/A",
        Destino: transferencia.destinoNombre || transferencia.destino?.nombre || "N/A",
      }))
      filename = "Reporte_Transferencias"
    }

    if (data.length > 0) {
      exportToCsv(data, filename)
    }
  }

  const isLoading = isLoadingVentas || isLoadingMermas || isLoadingTransferencias || isLoadingProductos

  return (
    <StaggerContainer className="space-y-4">
      <StaggerItem className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <Select value={tipoMovimiento} onValueChange={setTipoMovimiento}>
            <SelectTrigger className="w-50">
              <SelectValue placeholder="Tipo de movimiento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ventas">Ventas</SelectItem>
              <SelectItem value="mermas">Mermas</SelectItem>
              <SelectItem value="transferencias">Transferencias</SelectItem>
            </SelectContent>
          </Select>

          <Select value={productoId} onValueChange={setProductoId}>
            <SelectTrigger className="w-62.5">
              <SelectValue placeholder="Filtrar por producto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los productos</SelectItem>
              {productos?.map((producto) => (
          <SelectItem key={producto.id} value={producto.id}>
            {getProductDisplayIdentifier(producto)}
          </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DateRangePicker
            value={dateRange}
            onChange={(range) => {
              if (range?.from && range?.to) {
          setDateRange({ from: range?.from, to: range?.to })
              }
            }}
          />
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

      <StaggerItem>
        <AnimatedCard>
        <Card className={surfaceCardClass}>
          <CardContent className="p-4">
            <h3 className="mb-4 text-lg font-medium">
              {tipoMovimiento === "ventas"
                ? "Evolución de Ventas"
                : tipoMovimiento === "mermas"
                  ? "Evolución de Mermas"
                  : "Evolución de Transferencias"}
            </h3>
            {isLoading ? (
              <Skeleton className="h-75 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="cantidad" name="Cantidad" stroke="#8884d8" activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
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
              {isLoading ? (
                <div className="p-4">
                  <Skeleton className="h-75 w-full" />
                </div>
              ) : tipoMovimiento === "ventas" ? (
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Punto de Venta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ventasFiltradas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No hay ventas en este periodo
                        </TableCell>
                      </TableRow>
                    ) : (
                      ventasFiltradas.map((venta) => (
                        <TableRow key={venta.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell className="font-medium">{venta.ventaId}</TableCell>
                          <TableCell>
                            {getProductDisplayIdentifier({
                              id: venta.productoId,
                              nombre: venta.producto?.nombre || venta.productoNombre,
                              codigoInterno: venta.producto?.codigoInterno || venta.productoCodigoInterno,
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge>{venta.cantidad}</Badge>
                          </TableCell>
                          <TableCell>{format(new Date(venta.createdAt), "dd/MM/yyyy")}</TableCell>
                          <TableCell>{venta.puntoDeVenta?.nombre}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              ) : tipoMovimiento === "mermas" ? (
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mermasFiltradas?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No hay mermas en este periodo
                        </TableCell>
                      </TableRow>
                    ) : (
                      mermasFiltradas?.map((merma) => (
                        <TableRow key={merma.mermaId} className="hover:bg-muted/50 transition-colors">
                          <TableCell className="font-medium">{merma.mermaId}</TableCell>
                          <TableCell>
                            {getProductDisplayIdentifier({
                              id: merma.productoId,
                              nombre: getProductoById(merma.productoId)?.nombre || merma.producto?.nombre,
                              codigoInterno:
                                getProductoById(merma.productoId)?.codigoInterno ||
                                merma.producto?.codigoInterno,
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="destructive">{merma.cantidad}</Badge>
                          </TableCell>
                          <TableCell>{format(new Date(merma.createdAt), "dd/MM/yyyy")}</TableCell>
                          <TableCell>{merma.motivo}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transferenciasFiltradas?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No hay transferencias en este periodo
                        </TableCell>
                      </TableRow>
                    ) : (
                      transferenciasFiltradas?.map((transferencia) => (
                        <TableRow key={transferencia.transferenciaId} className="hover:bg-muted/50 transition-colors">
                          <TableCell className="font-medium">{transferencia.transferenciaId}</TableCell>
                          <TableCell>
                            {getProductDisplayIdentifier({
                              id: transferencia.productoId,
                              nombre:
                                getProductoById(transferencia.productoId)?.nombre ||
                                transferencia.producto?.nombre,
                              codigoInterno:
                                transferencia.productoCodigoInterno ||
                                getProductoById(transferencia.productoId)?.codigoInterno ||
                                transferencia.producto?.codigoInterno,
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{transferencia.cantidad}</Badge>
                          </TableCell>
                          <TableCell>{format(new Date(transferencia.createdAt), "dd/MM/yyyy")}</TableCell>
                        </TableRow>
                      ))
                    )}
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
