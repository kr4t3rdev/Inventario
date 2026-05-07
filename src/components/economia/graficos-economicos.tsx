"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useIsMobile } from "@/hooks/use-mobile"
import { useGetDashboardStatsQuery } from "@/lib/redux/services/dashboardApi"
import { useGetEmpleadosQuery } from "@/lib/redux/services/empleadosApi"
import { useGetGastosCompraQuery, useGetGastosCompraRestockQuery } from "@/lib/redux/services/GastosCompraApi"
import { useGetMermasQuery } from "@/features/mermas/api/mermasApi"
import React from "react"
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts"
import { ChartAreaInteractive } from "../chart-area-interactive"
import { useGetGastosDEQuery } from "@/lib/redux/services/gastosDEApi"
import { useGetPagoSalariosQuery } from "@/lib/redux/services/pagoSalarioApi"

export function GraficosEconomicos() {

   const isMobile = useIsMobile()
    const [timeRange, setTimeRange] = React.useState("6m")
    const { data: gastosCompra } = useGetGastosCompraQuery()
    const { data: gastosCompraRestock } = useGetGastosCompraRestockQuery()
    //const { data: gastosCompraRegular } = useGetGastosCompraRegularQuery()
    const { data: pagoSalario } = useGetPagoSalariosQuery()
    const { data: gastosDE } = useGetGastosDEQuery()
    const { data: merma } = useGetMermasQuery()
    const { data: dashboardStats, isLoading } = useGetDashboardStatsQuery()
  
    React.useEffect(() => {
      if (isMobile) {
        setTimeRange("3m")
      }
    }, [isMobile])
  
    // Transform API data to chart format
    const chartData = React.useMemo(() => {
      if (!dashboardStats?.datosPorMes) return []

      let filteredData = [...dashboardStats.datosPorMes]

      // Filter based on time range
      if (timeRange === "3m") {
        filteredData = filteredData.slice(-3)
      } else if (timeRange === "1m") {
        filteredData = filteredData.slice(-1)
      }

      return filteredData.map((item) => ({
        periodo: item.mes,
        ingresosVentas: item.ingresosVentas,
        ingresosServicios: item.ingresosServicios,
        ingresos: item.ingresosServicios + item.ingresosVentas,
        gastos: item.gastosDeExplotacion + item.gastosCompras + item.gastosMermas + item.gastosSalarios,
        beneficio: item.ingresosVentas + item.ingresosServicios - item.gastosDeExplotacion,
      }))
    }, [dashboardStats, timeRange])

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"]

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "CUP",
    }).format(value)
  }
  

  // const datosGraficoTendencia: DatosGrafico[] = Array.isArray(datosFinancieros) ? datosFinancieros?.map((dato) => ({
  //   mes: dato?.periodo?.split("-")[1],
  //   ingresos: dato.ingresos,
  //   gastos: dato.gastos,
  //   utilidad: dato.utilidad,
  // })) : []
  // const data = datosGraficoTendencia.find((e) => e.gastos)


  const datosGastosPorCategoria =
    (chartData?.length ?? 0) > 0
      ? [
          { name: "Compras", value: gastosCompra ? gastosCompra.reduce((acc, curr) => acc + curr.total, 0) : 0 },
          { name: "Restock", value: gastosCompraRestock ? gastosCompraRestock.reduce((acc, curr) => acc + curr.total, 0) : 0 },
          { name: "Salarios", value: pagoSalario ? pagoSalario.reduce((acc, curr) => acc + curr.salario, 0) : 0 },
          { name: "Gastos de Explotación", value: gastosDE ? gastosDE.reduce((acc, curr) => acc + curr.monto, 0) : 0 },
          { name: "Mermas", value: merma ? merma.reduce((acc, curr) => acc + curr.cantidad * (curr.producto?.precioCosto ?? 0), 0) : 0 },
        ]
      : []

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Cargando gráficos...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Análisis Financiero</h2>
        <Select value={periodoSeleccionado} onValueChange={setPeriodoSeleccionado}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2025-7">2025</SelectItem>
            <SelectItem value="2026">2026</SelectItem>
          </SelectContent>
        </Select>
      </div> */}

      <Tabs defaultValue="tendencias" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="tendencias">Tendencias</TabsTrigger>
          <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
          <TabsTrigger value="gastos">Distribución Gastos</TabsTrigger>
          <TabsTrigger value="rentabilidad">Rentabilidad</TabsTrigger>
        </TabsList>

        <TabsContent value="tendencias">
          <Card>
            <CardHeader>
              <CardTitle>Tendencia de Ingresos vs Gastos</CardTitle>
              <CardDescription>Evolución mensual de ingresos, gastos</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ChartAreaInteractive />
                  {/* <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis tickFormatter={formatCurrency} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Area
                    type="monotone"
                    dataKey="ingresos"
                    stackId="1"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="gastos"
                    stackId="2"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="utilidad"
                    stackId="3"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.6}
                  />
                </ChartAreaInteractive> */}
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparativo">
          <Card>
            <CardHeader>
              <CardTitle>Comparativo Mensual</CardTitle>
              <CardDescription>Comparación de ingresos y gastos por mes</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400} className="aspect-auto h-[250px] w-full">
                <BarChart data={chartData}>
                  <XAxis dataKey="periodo" />
                  <YAxis dataKey="ingresos" />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="ingresos" fill="#10b981" name="Ingresos" />
                  <Bar dataKey="gastos" fill="#ef4444" name="Gastos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gastos">
          <Card>
            <CardHeader>
              <CardTitle>Distribución de Gastos</CardTitle>
              <CardDescription>Desglose de gastos por categoría (mes actual)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={datosGastosPorCategoria.filter(item => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {datosGastosPorCategoria.filter(item => item.value > 0).map((entry, index) => (

                            <Cell key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          />

                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              {datosGastosPorCategoria.filter(item => item.value === 0).length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Categorías sin gastos (0%):</h4>
                  <ul className="space-y-1">
                    {datosGastosPorCategoria.filter(item => item.value === 0).map((cat, index) => (
                      <li key={index} className="text-sm text-muted-foreground">
                        {cat.name}: {formatCurrency(cat.value)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rentabilidad">
          <Card>
            <CardHeader>
              <CardTitle>Análisis de Rentabilidad</CardTitle>
              <CardDescription>Margen de utilidad mensual</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periodo" />
                  <YAxis
                    tickFormatter={(value) =>
                      `${((value / (chartData?.find((d) => d.periodo === value)?.ingresos ?? 0) || 1) * 100)}%`
                    }
                  />
                  <Tooltip
                    formatter={(value: number, name, props) => {
                      const margen = (value / props.payload.ingresos) * 100
                      return [`${margen.toFixed(1)}%`, "Margen de Utilidad"]
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="utilidad"
                    stroke="#8884d8"
                    strokeWidth={3}
                    dot={{ fill: "#8884d8", strokeWidth: 2, r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
