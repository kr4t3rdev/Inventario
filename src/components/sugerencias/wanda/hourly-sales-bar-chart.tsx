
"use client"

import { useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, Tooltip, Area } from "recharts"
import { BarChart as BarChartIcon } from "lucide-react"
import { chartOpacity, chartPalette, chartTooltipItemStyle, chartTooltipLabelStyle, chartTooltipStyle, formatCurrency } from "@/components/sugerencias/wanda/chart-theme"

interface HourlyData {
  hora: string
  total: number
  cantidad: number
}

interface HourlySalesBarChartProps {
  data: HourlyData[]
}

/**
 * @description Grafico de barras mostrando las ventas agrupadas por hora del dia (00:00–23:00).
 * Permite alternar entre vista de monto total y cantidad de transacciones.
 * @param {HourlySalesBarChartProps} props - Props del componente.
 * @returns {JSX.Element} Grafico de barras horarias.
 */
export function HourlySalesBarChart({ data }: HourlySalesBarChartProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [mode, setMode] = useState<"monto" | "cantidad">("monto")

  const chartData = data.map((d) => ({
    hora: d.hora,
    total: d.total,
    cantidad: d.cantidad,
  }))

  const handleMouseEnter = () => setIsHovered(true)
  const handleMouseLeave = () => {
    setIsHovered(false)
    setActiveIndex(null)
  }

  return (
    <div
      className="flex flex-col h-full w-full bg-card text-card-foreground p-4 rounded-lg border shadow-sm transition-all duration-300 hover:shadow-lg cursor-pointer group motion-reduce:transition-none"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          {isHovered && (
            <BarChartIcon className="h-3 w-3 text-muted-foreground animate-pulse-subtle" />
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setMode("monto")}
            className={`text-xs px-2 py-0.5 rounded transition-all ${
              mode === "monto"
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monto
          </button>
          <button
            onClick={() => setMode("cantidad")}
            className={`text-xs px-2 py-0.5 rounded transition-all ${
              mode === "cantidad"
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Cantidad
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            barCategoryGap={isHovered ? 4 : 6}
            onMouseMove={(e) => {
              if (e.activeTooltipIndex !== undefined) {
                setActiveIndex(e.activeTooltipIndex)
              }
            }}
            onMouseLeave={handleMouseLeave}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="hsl(var(--border))"
              opacity={isHovered ? 0.5 : 0.3}
            />
            <XAxis
              dataKey="hora"
              axisLine={false}
              tickLine={false}
              tick={{
                fontSize: 9,
                fill: isHovered ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
              }}
              interval={2}
              className="transition-all duration-300"
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{
                fontSize: 10,
                fill: isHovered ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
              }}
              tickFormatter={(value) =>
                mode === "monto" ? `${Math.round(value / 1000)}k` : `${Math.round(value)}`
              }
              className="transition-all duration-300"
            />
            <Tooltip
              contentStyle={chartTooltipStyle}
              labelStyle={chartTooltipLabelStyle}
              itemStyle={chartTooltipItemStyle}
              formatter={(value: number, name: string) => {
                if (name === "total") return [formatCurrency(value), "Monto"]
                if (name === "cantidad") return [`${value}`, "Transacciones"]
                return [value, name]
              }}
              labelFormatter={(label) => `Hora ${label}`}
              animationDuration={300}
            />
            <Bar
              dataKey={mode === "monto" ? "total" : "cantidad"}
              radius={[3, 3, 0, 0]}
              barSize={8}
              animationDuration={400}
              animationEasing="ease-out"
            >
              {chartData.map((entry, index) => {
                const isActive = activeIndex === index
                const isHoveredBar = isHovered && activeIndex === index
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={isActive ? chartPalette.alert : chartPalette.accentPrimary}
                    stroke={isHoveredBar ? "white" : "none"}
                    strokeWidth={isHoveredBar ? 1 : 0}
                    opacity={
                      isHovered && activeIndex !== null && activeIndex !== index
                        ? chartOpacity.muted
                        : chartOpacity.default
                    }
                    className="transition-all duration-300"
                  />
                )
              })}
            </Bar>
            <Area
              type="monotone"
              dataKey={mode === "monto" ? "total" : "cantidad"}
              stroke="none"
              fill={chartPalette.accentPrimary}
              fillOpacity={0.08}
              className="pointer-events-none"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
