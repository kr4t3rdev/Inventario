"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Zap } from "lucide-react"
//import { useEffect, useState } from "react"
import { useGetVentasQuery } from "@/features/ventas/api/ventasApi"
import { useGetGastosCompraQuery, useGetGastosCompraRestockQuery, useGetGastosCompraRegularQuery } from "@/lib/redux/services/GastosCompraApi"
import { useGetEmpleadosQuery } from "@/lib/redux/services/empleadosApi"
import { useGetMermasQuery } from "@/features/mermas/api/mermasApi"
import { useGetGastosDEQuery } from "@/lib/redux/services/gastosDEApi"
import { useGetPagoSalariosQuery } from "@/lib/redux/services/pagoSalarioApi"
import { useGetVentaServiciosQuery } from "@/features/venta-servicios/api/ventaServiciosApi"
import { flattenVentas } from "@/lib/ventas-utils"

export function ResumenFinanciero() {
  const { data:ventas, isLoading: isLoadingVentas } = useGetVentasQuery()
  const { data:ventaServicios, isLoading: isLoadingVentaServicios } = useGetVentaServiciosQuery()
  const { data:empleados, isLoading: isLoadingEmpleados } = useGetEmpleadosQuery()
  const { data:gastosCompra, isLoading: isLoadingGC } = useGetGastosCompraQuery()
  const { data:gastosCompraRestock} = useGetGastosCompraRestockQuery()
  const { data:gastosCompraRegular } = useGetGastosCompraRegularQuery()
  const { data:gastosDE, isLoading: isLoadingGS } = useGetGastosDEQuery()
  const { data:gastosMermas, isLoading: isLoadingMermas } = useGetMermasQuery()
  const { data: pagosSalario, isLoading: isLoadingSalario } = useGetPagoSalariosQuery(  )
  const ventasLineas = useMemo(() => flattenVentas(ventas), [ventas])
  


   
  const totalGastosCompra = gastosCompra?.reduce((sum, gasto) => sum + gasto.total, 0)
  const totalGastosCompraRestock = gastosCompraRestock?.reduce((sum, gasto) => sum + gasto.total, 0)
  const totalGastosCompraRegular = gastosCompraRegular?.reduce((sum, gasto) => sum + gasto.total, 0)
  const totalGastosSalarios = pagosSalario?.reduce((sum, gasto) => sum + gasto.salario, 0)
  const TotalServicios = ventaServicios?.reduce((sum, serv) => sum + serv.total, 0)
  const TotalVentas = ventasLineas.reduce(
    (sum, ingreso) => sum + (ingreso.totalLinea || 0) - (ingreso.descuento ?? 0),
    0,
  )
  const totalGastosServicio = gastosDE?.reduce((sum, gasto) => sum + gasto.monto, 0)
  const totalGastosMermas = gastosMermas?.reduce((sum, gasto) => sum + (gasto?.producto?.precioCosto ?? 0) * gasto.cantidad, 0)
  const ingresos = (TotalServicios ?? 0 ) + (TotalVentas ?? 0)
  const gastos = (totalGastosCompra ?? 0) + (totalGastosMermas ?? 0) + (totalGastosSalarios ?? 0) + (totalGastosServicio ?? 0)
  const utilidadNeta = (ingresos ?? 0) - gastos 
  const utilidadBruto = (ingresos ?? 0) - (totalGastosCompra ?? 0)
  const margen = (ingresos ?? 0) > 0 ? (utilidadNeta / (ingresos ?? 0)) * 100 : 0 
  const ventasCount = ventasLineas.length
  const serviciosCount = ventaServicios?.length
  const empleadosCount = empleados?.length




  if (isLoadingVentas || isLoadingSalario || isLoadingGC || isLoadingEmpleados || isLoadingGS || isLoadingMermas || isLoadingVentaServicios) {
    return <div>Cargando resumen financiero...</div>
  }

  // if (!data) {
  //   return <div>Error al cargar datos</div>
  // }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "CUP",
    }).format(amount)
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Ingresos Totales */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className=" font-bold text-green-600">{formatCurrency(ingresos ?? 0)}</div>
          <p className="text-xs text-muted-foreground">{ventasCount} ventas este mes</p>
          <p className="text-xs text-muted-foreground"> {serviciosCount} servicios este mes </p>
          <div className="gap-2 mt-3 ml-auto">
            <Badge variant="outline" className="text-xs md:text- bg-green-600">
              Compras: {formatCurrency(TotalVentas ?? 0)}
            </Badge>
            <Badge variant="outline" className="text-xs bg-blue-600 mt-2.5">
              Servicios: {formatCurrency(TotalServicios ?? 0)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Gastos Totales */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gastos Totales</CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="font-bold text-red-600">{formatCurrency(gastos)}</div>
          <div className="gap-2 mt-1 ml-auto">
            <Badge variant="outline" className="text-xs bg-red-600">
              Compras: {formatCurrency(totalGastosCompra ?? 0)}
            </Badge>
            <Badge variant="outline" className="text-xs bg-red-400 mt-2.5 ml-2">
              Restock: {formatCurrency(totalGastosCompraRestock ?? 0)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Utilidad Neta */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Utilidad Neta</CardTitle>
          {utilidadNeta >= 0 ? (
            <TrendingUp className="h-4 w-4 text-green-600" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-600" />
          )}
        </CardHeader>
        <CardContent>
          <div className={`font-bold ${utilidadNeta >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(utilidadNeta)}
          </div>
          <p className="text-xs text-muted-foreground">Margen: {margen.toFixed(1)}%</p>
        </CardContent>
      </Card>

      {/* Gastos por Categoría */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Desglose Gastos</CardTitle>
          <Zap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Salarios:</span>
              <span className="font-medium">{formatCurrency(totalGastosSalarios ?? 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Gastos de Explotaciòn:</span>
              <span className="font-medium">{formatCurrency(totalGastosServicio ?? 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Mermas:</span>
              <span className="font-medium">{formatCurrency(totalGastosMermas ?? 0)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
