"use client"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useGetDashboardStatsQuery } from "@/lib/redux/services/dashboardApi"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"

const chartConfig = {
  stockTotal: {
    label: "Stock Total",
    color: 'oklch(0.627 0.265 303.9)',
  },
  productos: {
    label: "Productos",
    color:'oklch(0.488 0.243 264.376)',
  },
} satisfies ChartConfig

export function StockDistributionChart() {
  const { data: dashboardStats, isLoading, error } = useGetDashboardStatsQuery()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Distribución de Stock por Categoría</CardTitle>
          <CardDescription>Stock y productos por categoría</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error || !dashboardStats?.distribucionStock) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Distribución de Stock por Categoría</CardTitle>
          <CardDescription>Error al cargar datos</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribución de Stock por Categoría</CardTitle>
        <CardDescription>Stock total y número de productos por categoría</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dashboardStats.distribucionStock} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="categoria" tick={{ fontSize: 13 }} angle={-45} textAnchor="end" height={80} />
              <YAxis yAxisId="left" orientation="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip
                formatter={(value, name) => [
                  typeof value === "number" ? value.toLocaleString() : value,
                  name === "stockTotal" ? "Stock Total" : "Productos",
                ]}
                labelStyle={{ fontWeight: "bold" }}
                contentStyle={{ backgroundColor: "Background", borderRadius: "4px", border: "0.1px solid #eee" }}
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="stockTotal"
                fill={`${(chartConfig.stockTotal.color)}`}
                name="Stock Total"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                yAxisId="right"
                dataKey="productos"
                fill={`${(chartConfig.productos.color)}`}
                name="Productos"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
