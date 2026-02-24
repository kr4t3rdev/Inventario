"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts"
import { useGetDashboardStatsQuery } from "@/lib/redux/services/dashboardApi"

import { useIsMobile } from "@/hooks/use-mobile"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Skeleton } from "@/components/ui/skeleton"

const chartConfig = {
  ingresos: {
    label: "Ingresos",
    color: "0.646 0.222 41.116", // hsl(var(--chart-1))
  },
  gastos: {
    label: "Gastos",
    color: "0.6 0.118 184.704", // hsl(var(--chart-2))
  },
} satisfies ChartConfig

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("6m")
  const [viewMode, setViewMode] = React.useState<"mes" | "semana">("mes")
  const { data: dashboardStats, isLoading, error } = useGetDashboardStatsQuery()

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("3m")
    }
  }, [isMobile])

  // Transform API data to chart format
  const chartData = React.useMemo(() => {
    const dataSource = viewMode === "semana" ? dashboardStats?.datosPorSemana : dashboardStats?.datosPorMes
    if (!dataSource) return []

    let filteredData = [...dataSource]

    // Filter based on time range
    if (timeRange === "3m") {
      filteredData = filteredData.slice(-3)
    } else if (timeRange === "1m") {
      filteredData = filteredData.slice(-1)
    }

    return filteredData.map((item) => ({
      periodo: 'mes' in item ? item.mes : item.semana,
      ingresos: item.ingresosVentas + item.ingresosServicios,
      gastos:item.gastosSalarios + item.gastosCompras + item.gastosMermas + item.gastosDeExplotacion,
      beneficio: item.ingresosVentas + item.ingresosServicios - (item.gastosCompras + item.gastosSalarios + item.gastosDeExplotacion + item.gastosMermas),
    }))
  }, [dashboardStats, timeRange, viewMode])

  return (
    <Card className="@container/card">
      <CardHeader className="relative">
        <CardTitle>Ingresos vs Gastos</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">
            Comparativa ⬆️ ⬇️ últimos{" "}
            {timeRange === "6m" ? `6 ${viewMode === "semana" ? "semanas" : "meses"}` : timeRange === "3m" ? `3 ${viewMode === "semana" ? "semanas" : "meses"}` : `1 ${viewMode === "semana" ? "semana" : "mes"}`}
          </span>
          <span className="@[540px]/card:hidden">
            Últimos {timeRange === "6m" ? `6 ${viewMode === "semana" ? "semanas" : "meses"}` : timeRange === "3m" ? `3 ${viewMode === "semana" ? "semanas" : "meses"}` : `1 ${viewMode === "semana" ? "semana" : "mes"}`}
          </span>
        </CardDescription>
        <div className="absolute right-4 top-4 flex gap-2">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => setViewMode(value as "mes" | "semana")}
            variant="outline"
            className="h-8"
          >
            <ToggleGroupItem value="mes" className="h-8 px-2.5">
              Mes
            </ToggleGroupItem>
            <ToggleGroupItem value="semana" className="h-8 px-2.5">
              Semana
            </ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="@[767px]/card:flex hidden"
          >
            <ToggleGroupItem value="6m" className="h-8 px-2.5">
              6 {viewMode === "semana" ? "semanas" : "meses"}
            </ToggleGroupItem>
            <ToggleGroupItem value="3m" className="h-8 px-2.5">
              3 {viewMode === "semana" ? "semanas" : "meses"}
            </ToggleGroupItem>
            <ToggleGroupItem value="1m" className="h-8 px-2.5">
              1 {viewMode === "semana" ? "semana" : "mes"}
            </ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="@[767px]/card:hidden flex w-40" aria-label="Select a value">
              <SelectValue placeholder={`6 ${viewMode === "semana" ? "semanas" : "meses"}`} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="6m" className="rounded-lg">
                6 {viewMode === "semana" ? "semanas" : "meses"}
              </SelectItem>
              <SelectItem value="3m" className="rounded-lg">
                3 {viewMode === "semana" ? "semanas" : "meses"}
              </SelectItem>
              <SelectItem value="1m" className="rounded-lg">
                1 {viewMode === "semana" ? "semana" : "mes"}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {isLoading ? (
          <div className="aspect-auto h-[250px] w-full flex items-center justify-center">
            <Skeleton className="h-[200px] w-full" />
          </div>
        ) : error ? (
          <div className="aspect-auto h-[250px] w-full flex items-center justify-center">
            <p className="text-muted-foreground">Error al cargar datos</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fillIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="0.646 0.222 41.116" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="0.646 0.222 41.116" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillGastos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="0.6 0.118 184.704" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="0.6 0.118 184.704" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="periodo"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  if (viewMode === "semana") {
                    const [, week] = value.split("-W")
                    return `S${week}`
                  } else {
                    const [year, month] = value.split("-")
                    const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1)
                    return date.toLocaleDateString("es-ES", {
                      month: "short",
                    })
                  }
                }}
              />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
              <Legend />
              <Tooltip
                formatter={(value) => [`$${value}`, ""]}
                labelFormatter={(label) => {
                  if (viewMode === "semana") {
                    const [, week] = label.split("-W")
                    return `Semana ${week}`
                  } else {
                    const [year, month] = label.split("-")
                    const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1)
                    return date.toLocaleDateString("es-ES", {
                      month: "long",
                      year: "numeric",
                    })
                  }
                }}
                labelStyle={{ fontWeight: "bold" }}
                contentStyle={{ backgroundColor: "Background", borderRadius: "8px", border: "1px solid #eee" }}
              />
              <Area
                type="stepBefore"
                dataKey="ingresos"
                stroke={`${chartConfig.ingresos}`} // hsl(var(--chart-1))
                fillOpacity={2}
                fill="url(#fillIngresos)"
              />
              <Area
                type="monotone"
                dataKey="gastos"
                stroke={`${chartConfig.gastos}`} // hsl(var(--chart-2))
                fillOpacity={2}
                fill="url(#fillGastos)"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
