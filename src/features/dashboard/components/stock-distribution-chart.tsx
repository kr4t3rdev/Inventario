"use client"

import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

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
      color: "var(--chart-1)",
    },
    productos: {
      label: "Productos",
      color: "var(--chart-2)",
    },
  } satisfies ChartConfig

  if (isEmpty) {
    return (
      <Card className={`min-w-0 ${className ?? ''}`}>
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
    <Card className={`min-w-0 ${className ?? ''}`}>
      <CardHeader>
        <CardTitle>Distribución de Stock</CardTitle>
        <CardDescription>Stock total y productos por categoría</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        <ul
          aria-label="Distribución de stock por categoría"
          className="space-y-2 sm:sr-only"
        >
          {data.map((item) => (
            <li
              key={item.categoria}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 rounded-lg border border-border/70 px-3 py-2"
            >
              <span className="min-w-0 break-words font-medium">{item.categoria}</span>
              <span className="tabular-nums">{item.stockTotal.toLocaleString('es')} unidades</span>
              <span className="text-sm text-muted-foreground">Existencias</span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {item.productos.toLocaleString('es')} productos
              </span>
            </li>
          ))}
        </ul>
        <ChartContainer
          aria-hidden="true"
          config={chartConfig}
          className="hidden h-[350px] min-w-0 max-w-full sm:block"
        >
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
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(label) => `Categoría: ${label}`}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
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
