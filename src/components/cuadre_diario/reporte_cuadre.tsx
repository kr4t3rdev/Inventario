"use client"

import { useState, useMemo } from "react"
import { useGetProductosQuery } from "@/lib/redux/services/productosApi"
import { useGetVentasQuery } from "@/lib/redux/services/ventasApi"
import { useGetTransferenciasQuery } from "@/lib/redux/services/transferenciasApi"
import { useGetAlmacenesQuery } from "@/lib/redux/services/almacenesApi"
import { useGetPuntosDeVentaQuery } from "@/lib/redux/services/puntosDeVentaApi"
import { useGetStockPorUbicacionQuery } from "@/lib/redux/services/stockUbicacionApi"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns"
import { AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Download, FileText } from "lucide-react"
import { exportToPdf, exportToCsv } from "@/lib/export-utils"
import { flattenVentas } from "@/lib/ventas-utils"


interface CuadreAlmacenPuntoVenta {
  productoId: string
  nombre: string
  transferenciasSalida: number
  transferenciasEntrada: number
  discrepancia: number
  estado: 'balanceado' | 'desbalanceado'
}

interface CuadrePuntoVentaVentas {
  productoId: string
  nombre: string
  stockPuntoVenta: number
  ventas: number
  stockEsperado: number
  discrepancia: number
  estado: 'balanceado' | 'desbalanceado'
}

type Periodo = 'diario' | 'semanal' | 'mensual'

export function CuadreDiario() {
  const [periodo, setPeriodo] = useState<Periodo>('diario')
  const [tipoCuadre, setTipoCuadre] = useState<'almacen_vs_punto_venta' | 'punto_venta_vs_ventas'>('almacen_vs_punto_venta')
  const [selectedAlmacen, setSelectedAlmacen] = useState<string>('')
  const [selectedPuntoVenta, setSelectedPuntoVenta] = useState<string>('')

  const { data: productos, isLoading: isLoadingProductos } = useGetProductosQuery()
  const { data: ventas, isLoading: isLoadingVentas } = useGetVentasQuery()
  const { data: transferenciasData, isLoading: isLoadingTransferencias } = useGetTransferenciasQuery()
  const transferencias = transferenciasData?.transferencias || []
  const { data: almacenes, isLoading: isLoadingAlmacenes } = useGetAlmacenesQuery()
  const { data: puntosDeVenta, isLoading: isLoadingPuntosDeVenta } = useGetPuntosDeVentaQuery()
  const { data: stockPuntoVenta, isLoading: isLoadingStockPuntoVenta } = useGetStockPorUbicacionQuery(
    { ubicacionId: selectedPuntoVenta, tipoUbicacion: 'punto_venta' },
    { skip: !selectedPuntoVenta }
  )
  const ventasLineas = useMemo(() => flattenVentas(ventas), [ventas])

  const isLoading = isLoadingProductos || isLoadingVentas || isLoadingTransferencias || isLoadingAlmacenes || isLoadingPuntosDeVenta || isLoadingStockPuntoVenta

  const handleExportPdf = () => {
    const { inicio, fin } = getPeriodoFechas(periodo)
    const periodoTexto = `${format(inicio, 'dd/MM/yyyy')} - ${format(fin, 'dd/MM/yyyy')}`
    const tipoTexto = tipoCuadre === 'almacen_vs_punto_venta' ? 'Almacen_vs_Punto_Venta' : 'Punto_Venta_vs_Ventas'

    const exportData = tipoCuadre === 'almacen_vs_punto_venta'
      ? cuadreAlmacenPuntoVentaData.map(item => ({
          'Producto': item.nombre,
          'Transferencias Salida': item.transferenciasSalida,
          'Transferencias Entrada': item.transferenciasEntrada,
          'Discrepancia': item.discrepancia,
          'Estado': item.estado === 'balanceado' ? 'Balanceado' : 'Desbalanceado'
        }))
      : cuadrePuntoVentaVentasData.map(item => ({
          'Producto': item.nombre,
          'Stock Punto Venta': item.stockPuntoVenta,
          'Ventas': item.ventas,
          'Stock Esperado': item.stockEsperado,
          'Discrepancia': item.discrepancia,
          'Estado': item.estado === 'balanceado' ? 'Balanceado' : 'Desbalanceado'
        }))

    exportToPdf(exportData, null, `Reporte_Cuadre_${tipoTexto}_${periodo}_${periodoTexto}`)
  }

  const handleExportCsv = () => {
    const exportData = tipoCuadre === 'almacen_vs_punto_venta'
      ? cuadreAlmacenPuntoVentaData.map(item => ({
          producto: item.nombre,
          transferencias_salida: item.transferenciasSalida,
          transferencias_entrada: item.transferenciasEntrada,
          discrepancia: item.discrepancia,
          estado: item.estado === 'balanceado' ? 'Balanceado' : 'Desbalanceado'
        }))
      : cuadrePuntoVentaVentasData.map(item => ({
          producto: item.nombre,
          stock_punto_venta: item.stockPuntoVenta,
          ventas: item.ventas,
          stock_esperado: item.stockEsperado,
          discrepancia: item.discrepancia,
          estado: item.estado === 'balanceado' ? 'Balanceado' : 'Desbalanceado'
        }))

    exportToCsv(exportData, `reporte_cuadre_${tipoCuadre}_${periodo}`)
  }

  const getPeriodoFechas = (tipo: Periodo) => {
    const now = new Date()
    switch (tipo) {
      case 'diario':
        return { inicio: startOfDay(now), fin: endOfDay(now) }
      case 'semanal':
        return { inicio: startOfWeek(now, { weekStartsOn: 1 }), fin: endOfWeek(now, { weekStartsOn: 1 }) }
      case 'mensual':
        return { inicio: startOfMonth(now), fin: endOfMonth(now) }
    }
  }

  const cuadreAlmacenPuntoVentaData = useMemo(() => {
    if (!productos || !transferencias || !selectedAlmacen || !selectedPuntoVenta) return []

    const { inicio, fin } = getPeriodoFechas(periodo)

    return productos.map(producto => {
      // Transferencias de salida desde el almacén seleccionado hacia el punto de venta seleccionado
      const transferenciasSalida = transferencias
        .filter(transferencia => {
          const fechaTransferencia = new Date(transferencia.createdAt)
          return fechaTransferencia >= inicio && fechaTransferencia <= fin &&
                 transferencia.productoId === producto.id &&
                 transferencia.origenId === selectedAlmacen &&
                 transferencia.destinoId === selectedPuntoVenta &&
                 transferencia.tipoTransferencia === 'almacen_punto_venta'
        })
        .reduce((total, transferencia) => total + transferencia.cantidad, 0)

      // Transferencias de entrada al punto de venta seleccionado desde el almacén seleccionado
      const transferenciasEntrada = transferencias
        .filter(transferencia => {
          const fechaTransferencia = new Date(transferencia.createdAt)
          return fechaTransferencia >= inicio && fechaTransferencia <= fin &&
                 transferencia.productoId === producto.id &&
                 transferencia.origenId === selectedAlmacen &&
                 transferencia.destinoId === selectedPuntoVenta &&
                 transferencia.tipoTransferencia === 'almacen_punto_venta'
        })
        .reduce((total, transferencia) => total + transferencia.cantidad, 0)

      // Discrepancia entre lo que salió del almacén y lo que entró al punto de venta
      const discrepancia = transferenciasSalida - transferenciasEntrada

      const estado = Math.abs(discrepancia) < 0.01 ? 'balanceado' : 'desbalanceado'

      return {
        productoId: producto.id,
        nombre: producto.nombre,
        transferenciasSalida,
        transferenciasEntrada,
        discrepancia,
        estado
      } as CuadreAlmacenPuntoVenta
    })
  }, [productos, transferencias, periodo, selectedAlmacen, selectedPuntoVenta])

  const cuadrePuntoVentaVentasData = useMemo(() => {
    if (!productos || !stockPuntoVenta || !selectedPuntoVenta) return []

    const { inicio, fin } = getPeriodoFechas(periodo)

    return productos.map(producto => {
      // Stock actual en el punto de venta seleccionado
      const stockProducto = stockPuntoVenta.find(s => s.id === producto.id)?.stockUbicacion || 0

      // Ventas del período en el punto de venta seleccionado
      const ventasPeriodo = ventasLineas
        .filter((venta) => {
          const fechaVenta = new Date(venta.createdAt)
          return fechaVenta >= inicio && fechaVenta <= fin &&
                 venta.productoId === producto.id &&
                 venta.puntoDeVentaId === selectedPuntoVenta
        })
        .reduce((total, venta) => total + venta.cantidad, 0)

      // Stock esperado = stock actual - ventas (sin mermas)
      const stockEsperado = stockProducto - ventasPeriodo

      // Discrepancia = stock actual - stock esperado (debería ser 0 si no hay ventas pendientes)
      const discrepancia = stockProducto - stockEsperado

      const estado = Math.abs(discrepancia) < 0.01 ? 'balanceado' : 'desbalanceado'

      return {
        productoId: producto.id,
        nombre: producto.nombre,
        stockPuntoVenta: stockProducto,
        ventas: ventasPeriodo,
        stockEsperado,
        discrepancia,
        estado
      } as CuadrePuntoVentaVentas
    })
  }, [productos, ventasLineas, stockPuntoVenta, periodo, selectedPuntoVenta])

  const estadisticasAlmacenPuntoVenta = useMemo(() => {
    const totalProductos = cuadreAlmacenPuntoVentaData.length
    const productosBalanceados = cuadreAlmacenPuntoVentaData.filter(p => p.estado === 'balanceado').length
    const productosDesbalanceados = cuadreAlmacenPuntoVentaData.filter(p => p.estado === 'desbalanceado').length
    const discrepanciaTotal = cuadreAlmacenPuntoVentaData.reduce((sum, p) => sum + Math.abs(p.discrepancia), 0)

    return {
      totalProductos,
      productosBalanceados,
      productosDesbalanceados,
      discrepanciaTotal
    }
  }, [cuadreAlmacenPuntoVentaData])

  const estadisticasPuntoVentaVentas = useMemo(() => {
    const totalProductos = cuadrePuntoVentaVentasData.length
    const productosBalanceados = cuadrePuntoVentaVentasData.filter(p => p.estado === 'balanceado').length
    const productosDesbalanceados = cuadrePuntoVentaVentasData.filter(p => p.estado === 'desbalanceado').length
    const discrepanciaTotal = cuadrePuntoVentaVentasData.reduce((sum, p) => sum + Math.abs(p.discrepancia), 0)

    return {
      totalProductos,
      productosBalanceados,
      productosDesbalanceados,
      discrepanciaTotal
    }
  }, [cuadrePuntoVentaVentasData])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Cargando datos del cuadre...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Selectores de almacén y punto de venta */}
      <Card>
        <CardHeader>
          <CardTitle>Selección de Ubicaciones</CardTitle>
          <CardDescription>Selecciona el almacén y punto de venta para el cuadre</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Almacén</label>
              <select
                value={selectedAlmacen}
                onChange={(e) => setSelectedAlmacen(e.target.value)}
                className="w-full mt-1 p-2 border rounded"
              >
                <option value="">Seleccionar almacén</option>
                {almacenes?.map(almacen => (
                  <option key={almacen.almacenId} value={almacen.almacenId}>
                    {almacen.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Punto de Venta</label>
              <select
                value={selectedPuntoVenta}
                onChange={(e) => setSelectedPuntoVenta(e.target.value)}
                className="w-full mt-1 p-2 border rounded"
              >
                <option value="">Seleccionar punto de venta</option>
                {puntosDeVenta?.map(pv => (
                  <option key={pv.pvId} value={pv.pvId}>
                    {pv.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selector de tipo de cuadre */}
      <Card>
        <CardHeader>
          <CardTitle>Tipo de Cuadre</CardTitle>
          <CardDescription>Selecciona el tipo de cuadre que deseas revisar</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tipoCuadre} onValueChange={(value) => setTipoCuadre(value as 'almacen_vs_punto_venta' | 'punto_venta_vs_ventas')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="almacen_vs_punto_venta">Almacén vs Punto de Venta</TabsTrigger>
              <TabsTrigger value="punto_venta_vs_ventas">Punto de Venta vs Ventas</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Estadísticas */}
      {tipoCuadre === 'almacen_vs_punto_venta' ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{estadisticasAlmacenPuntoVenta.totalProductos}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Balanceados</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{estadisticasAlmacenPuntoVenta.productosBalanceados}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Desbalanceados</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{estadisticasAlmacenPuntoVenta.productosDesbalanceados}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Discrepancia Total</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{estadisticasAlmacenPuntoVenta.discrepanciaTotal.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{estadisticasPuntoVentaVentas.totalProductos}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Balanceados</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{estadisticasPuntoVentaVentas.productosBalanceados}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Desbalanceados</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{estadisticasPuntoVentaVentas.productosDesbalanceados}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Discrepancia Total</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{estadisticasPuntoVentaVentas.discrepanciaTotal.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Selector de período */}
      <Card>
        <CardHeader>
          <CardTitle>Reporte de Cuadre</CardTitle>
          <CardDescription>
            Comparación de stock físico vs movimientos del período
          </CardDescription>
          <div className="flex gap-2">
            <Button onClick={handleExportPdf} variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
            <Button onClick={handleExportCsv} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={periodo} onValueChange={(value) => setPeriodo(value as Periodo)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="diario">Diario</TabsTrigger>
              <TabsTrigger value="semanal">Semanal</TabsTrigger>
              <TabsTrigger value="mensual">Mensual</TabsTrigger>
            </TabsList>

            <TabsContent value={periodo} className="mt-6">
              <div className="space-y-4">
                {/* Alertas */}
                {tipoCuadre === 'almacen_vs_punto_venta' && estadisticasAlmacenPuntoVenta.productosDesbalanceados > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Se encontraron {estadisticasAlmacenPuntoVenta.productosDesbalanceados} productos con discrepancias entre almacén y punto de venta.
                      Revise los detalles a continuación.
                    </AlertDescription>
                  </Alert>
                )}

                {tipoCuadre === 'punto_venta_vs_ventas' && estadisticasPuntoVentaVentas.productosDesbalanceados > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Se encontraron {estadisticasPuntoVentaVentas.productosDesbalanceados} productos con discrepancias en el punto de venta vs ventas.
                      Revise los detalles a continuación.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Tabla de cuadre */}
                {tipoCuadre === 'almacen_vs_punto_venta' ? (
                  <div className="rounded-md border">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="h-12 px-4 text-left align-middle font-medium">Producto</th>
                          <th className="h-12 px-4 text-right align-middle font-medium">Transferencias Salida</th>
                          <th className="h-12 px-4 text-right align-middle font-medium">Transferencias Entrada</th>
                          <th className="h-12 px-4 text-right align-middle font-medium">Discrepancia</th>
                          <th className="h-12 px-4 text-center align-middle font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cuadreAlmacenPuntoVentaData.map((item) => (
                          <tr key={item.productoId} className="border-b">
                            <td className="p-4 align-middle font-medium">{item.nombre}</td>
                            <td className="p-4 text-right align-middle text-red-600">-{item.transferenciasSalida}</td>
                            <td className="p-4 text-right align-middle text-green-600">+{item.transferenciasEntrada}</td>
                            <td className={`p-4 text-right align-middle font-semibold ${
                              item.discrepancia === 0 ? 'text-green-600' :
                              item.discrepancia > 0 ? 'text-blue-600' : 'text-red-600'
                            }`}>
                              {item.discrepancia > 0 ? '+' : ''}{item.discrepancia.toFixed(2)}
                            </td>
                            <td className="p-4 text-center align-middle">
                              <Badge variant={item.estado === 'balanceado' ? 'default' : 'destructive'}>
                                {item.estado === 'balanceado' ? 'Balanceado' : 'Desbalanceado'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="h-12 px-4 text-left align-middle font-medium">Producto</th>
                          <th className="h-12 px-4 text-right align-middle font-medium">Stock Punto Venta</th>
                          <th className="h-12 px-4 text-right align-middle font-medium">Ventas</th>
                          <th className="h-12 px-4 text-right align-middle font-medium">Stock Esperado</th>
                          <th className="h-12 px-4 text-right align-middle font-medium">Discrepancia</th>
                          <th className="h-12 px-4 text-center align-middle font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cuadrePuntoVentaVentasData.map((item) => (
                          <tr key={item.productoId} className="border-b">
                            <td className="p-4 align-middle font-medium">{item.nombre}</td>
                            <td className="p-4 text-right align-middle">{item.stockPuntoVenta}</td>
                            <td className="p-4 text-right align-middle text-red-600">-{item.ventas}</td>
                            <td className="p-4 text-right align-middle font-semibold">{item.stockEsperado}</td>
                            <td className={`p-4 text-right align-middle font-semibold ${
                              item.discrepancia === 0 ? 'text-green-600' :
                              item.discrepancia > 0 ? 'text-blue-600' : 'text-red-600'
                            }`}>
                              {item.discrepancia > 0 ? '+' : ''}{item.discrepancia.toFixed(2)}
                            </td>
                            <td className="p-4 text-center align-middle">
                              <Badge variant={item.estado === 'balanceado' ? 'default' : 'destructive'}>
                                {item.estado === 'balanceado' ? 'Balanceado' : 'Desbalanceado'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Resumen del período */}
                <div className="text-sm text-muted-foreground text-center">
                  Período: {format(getPeriodoFechas(periodo).inicio, 'dd/MM/yyyy')} - {format(getPeriodoFechas(periodo).fin, 'dd/MM/yyyy')}
                  {tipoCuadre === 'almacen_vs_punto_venta' ? ' | Cuadre: Almacén vs Punto de Venta' : ' | Cuadre: Punto de Venta vs Ventas'}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
