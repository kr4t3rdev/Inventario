"use client"

import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"

export interface StockDistributionItem {
  categoria: string
  productos: number
  stockTotal: number
  valorTotal: number
}

interface StockDistributionChartProps {
  data: StockDistributionItem[]
  className?: string
}

/**
 * @description Gráfico de barras con doble eje Y que muestra la distribución de stock
 *              (stock total y cantidad de productos) por categoría.
 * @param {StockDistributionChartProps} props - Props del componente.
 * @returns {JSX.Element} Gráfico de distribución de stock.
 */
export function StockDistributionChart({ data, className }: StockDistributionChartProps) {
  const isEmpty = !data || data.length === 0

  const chartConfig = {
    stockTotal: {
      label: "Stock Total",
      color: "hsl(var(--chart-1))",
    },
    productos: {
      label: "Productos",
      color: "hsl(var(--chart-2))",
    },
  } satisfies ChartConfig

  if (isEmpty) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Distribución de Stock</CardTitle>
          <CardDescription>Stock total y productos por categoría</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
            No hay datos de distribución de stock
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Distribución de Stock</CardTitle>
        <CardDescription>Stock total y productos por categoría</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[350px] w-full">
          <BarChart data={data} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="categoria"
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 12 }}
            />
            <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{ fontSize: 13 }}
              formatter={(value: number, name: string) => {
                if (name === "stockTotal") {
                  return [value.toLocaleString(), "Stock Total"]
                }
                return [value.toLocaleString(), "Productos"]
              }}
              labelFormatter={(label: string) => `Categoría: ${label}`}
            />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="stockTotal"
              fill="var(--color-stockTotal)"
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
            <Bar
              yAxisId="right"
              dataKey="productos"
              fill="var(--color-productos)"
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
