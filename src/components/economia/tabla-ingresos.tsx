"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, TrendingUp, DollarSign } from "lucide-react"
import { useMemo, useState } from "react"
import { format } from "date-fns"
import { useGetVentasQuery } from "@/lib/redux/services/ventasApi"
import { useGetMermasQuery } from "@/lib/redux/services/mermasApi"
import { useGetGastosDEQuery } from "@/lib/redux/services/gastosDEApi"
import { useGetVentaServiciosQuery } from "@/lib/redux/services/ventaServiciosApi"
import { useGetPagoSalariosQuery } from "@/lib/redux/services/pagoSalarioApi"
import { flattenVentas } from "@/lib/ventas-utils"


export function TablaIngresos() {
 // const [ingresos, setIngresos] = useState<IngresoDetallado[]>([])
 const { data: ventas, isLoading } = useGetVentasQuery()
 const { data:gastosSalarios } = useGetPagoSalariosQuery()
 const { data: gastosDE } = useGetGastosDEQuery()
 const { data: merma } = useGetMermasQuery()
 const { data: ventaServicio, isLoading: isLoadingServicios } = useGetVentaServiciosQuery()
 const ventasLineas = useMemo(() => flattenVentas(ventas), [ventas])
   
  //const [filtroFecha, setFiltroFecha] = useState<Date>()
  const [ filtroPuntoVenta ] = useState<string>("todos")
  const [ busqueda, setBusqueda ] = useState("")


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "CUP",
    }).format(amount)
  }

  const ingresosFiltrados = ventasLineas.filter((venta) => {
    const nombreProducto = (venta.producto?.nombre || venta.productoNombre || '').toLowerCase()
    const coincideBusqueda = nombreProducto.includes(busqueda.toLowerCase())
    const coincidePuntoVenta = filtroPuntoVenta === "todos" || venta.puntoDeVentaId === filtroPuntoVenta
    return coincideBusqueda && coincidePuntoVenta
  })

  const totalIngresos = (ingresosFiltrados?.reduce((sum, ingreso) => sum + ((ingreso.totalLinea || 0) - (ingreso.descuento ?? 0)), 0) ?? 0) + (ventaServicio?.reduce((sum , serv) => sum + serv.total, 0) ?? 0) 
  //console.log(totalIngresos, ":totalIngresos");
  const totalCostos = ingresosFiltrados?.reduce((sum, ingreso) => sum + ingreso.cantidad * (ingreso?.producto?.precioCosto ?? 0), 0)
  const totalGastosSalarios = gastosSalarios?.reduce((sum, gasto) => sum + gasto.salario, 0)
  const totalGastosServicio = gastosDE?.reduce((sum, gasto) => sum + gasto.monto, 0)
  const totalGastosMermas = merma?.reduce((sum, gasto) => sum + (gasto?.producto?.precioCosto ?? 0) * gasto.cantidad, 0)
  const totalAgregado = (totalGastosSalarios ?? 0) + (totalGastosServicio ?? 0) + (totalGastosMermas ?? 0)
  const totalVentas = ingresosFiltrados?.length
  const margenBruto =
    (totalIngresos ?? 0) > 0
      ? (((totalIngresos ?? 0) - (totalCostos ?? 0)) / (totalIngresos ?? 0) * 100 )
      : 0
  //const margenPromedio = (totalVentas ?? 0) > 0 ? (margenBruto / (totalVentas ?? 0)) : 0
  const margenNeto = 
    (totalIngresos ?? 0) > 0
      ? ((totalIngresos ?? 0) - (totalAgregado ?? 0)) / (totalIngresos ?? 0) * 100
      : 0


  return (
    <div className="space-y-4">
      {/* Resumen de Ingresos */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ingresos</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalIngresos ?? 0)}</div>
            <p className="text-xs text-muted-foreground">{totalVentas} ventas registradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margen bruto</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{margenBruto.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Rentabilidad bruta en base a los gastos por productos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margen neto</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{margenNeto.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Rentabilidad neta en base a los gastos agregados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Venta Promedio</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency((totalVentas ?? 0) > 0 ? (totalIngresos ?? 0) / (totalVentas ?? 0) : 0)}
            </div>
            <p className="text-xs text-muted-foreground">Ticket promedio</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros y Controles */}
      <Card>
        <CardHeader>
          <CardTitle>Ingresos por Ventas y Servicios</CardTitle>
          <CardDescription>Detalle de todos los ingresos generados por ventas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por producto..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {/* <Select value={filtroPuntoVenta} onValueChange={setFiltroPuntoVenta}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Punto de venta" />
              </SelectTrigger>
              <SelectContent>
                  {
                    ptoVenta?.map((pv) => {
                      return (
                      <div key={pv.pvId}>
                          <SelectItem value="todos">{pv.nombre}</SelectItem>
                      </div>  
                      )
                    })
                  }                
              </SelectContent>
            </Select> */}

         </div>

          {/* Tabla de Ingresos */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Punto de Venta</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        <span className="ml-2">Cargando ingresos de ventas...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : ingresosFiltrados?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No se encontraron ingresos de ventas
                    </TableCell>
                  </TableRow>
                ) : (
                  ingresosFiltrados?.map((ingreso) => (
                    <TableRow key={ingreso.id}>
                      <TableCell>{format(new Date(ingreso.createdAt), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell className="font-medium">{ingreso?.producto?.nombre || ingreso.productoNombre || ingreso.productoId}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{ingreso?.puntoDeVenta?.nombre}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{ingreso.cantidad}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency((ingreso.totalLinea || 0) - (ingreso.descuento ?? 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {ingreso?.producto?.precioCosto
                          ? `${((((ingreso.totalLinea || 0) - (ingreso.descuento ?? 0)) - ingreso.cantidad * (ingreso?.producto?.precioCosto ?? 0)) / Math.max(1, (ingreso.totalLinea || 0)) * 100).toFixed(1)}%`
                          : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>          
        </CardContent>
      </Card>

      {/* Tabla de Ingresos por Servicios */}
      <Card>
        <CardHeader>
          <CardTitle>Ingresos por Servicios</CardTitle>
          <CardDescription>Detalle de todas los ingresos generados por servicios</CardDescription>
        </CardHeader>
        <CardContent>
        <div className="rounded-md border mt-10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Descripcion</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingServicios ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        <span className="ml-2">Cargando ingresos de servicios...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : !ventaServicio || ventaServicio.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No se encontraron ingresos de servicios
                    </TableCell>
                  </TableRow>
                ) : (
                  ventaServicio?.map((servicio, index) => (
                    <TableRow key={servicio.ventaServicioId || `servicio-${index}`}>
                      <TableCell>{servicio.createdAt ? format(new Date(servicio.createdAt), "dd/MM/yyyy HH:mm") : "N/A"}</TableCell>
                      <TableCell className="font-medium">{servicio?.servicio?.descripcion || "N/A"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{servicio?.servicio?.servicioId || "N/A"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(servicio.total)}
                      </TableCell>

                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
