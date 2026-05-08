
"use client"

import { useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, Tooltip } from "recharts"
import { BarChart as BarChartIcon } from "lucide-react"
import { chartOpacity, chartPalette, chartTooltipItemStyle, chartTooltipLabelStyle, chartTooltipStyle, formatCurrency } from "@/components/sugerencias/wanda/chart-theme"

interface MonthData {
  mes: string
  ventas: number
  servicios: number
  total: number
}

interface SalesByMonthBarChartProps {
  data: MonthData[]
}

/**
 * @description Barras mensuales para ventas y servicios.
 * @param {SalesByMonthBarChartProps} props - Props del componente.
 * @returns {JSX.Element} Barras con interacción al hover.
 */
export function SalesByMonthBarChart({ data }: SalesByMonthBarChartProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const handleMouseEnter = () => setIsHovered(true)
  const handleMouseLeave = () => {
    setIsHovered(false)
    setActiveIndex(null)
  }

  const handleBarMouseEnter = (_: any, index: number) => {
    setActiveIndex(index)
  }

  const handleBarMouseLeave = () => {
    setActiveIndex(null)
  }

  const chartData = data.map(d => ({
    name: d.mes,
    value: d.total,
    ventas: d.ventas,
    servicios: d.servicios
  }))

  return (
    <div 
      className="flex flex-col h-full w-full bg-card text-card-foreground p-4 rounded-lg border shadow-sm transition-all duration-300 hover:shadow-lg cursor-pointer group motion-reduce:transition-none"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
       <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Total Ventas Atendidas Por Mes</h3>
          {isHovered && (
            <BarChartIcon className="h-3 w-3 text-muted-foreground animate-pulse-subtle" />
          )}
        </div>
        <span className={`text-xs transition-all duration-300 ${isHovered ? "text-foreground font-medium" : "text-muted-foreground"}`}>
          Ventas/Mes
        </span>
      </div>
      <div className="flex-1 min-h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={chartData} 
            barCategoryGap={isHovered ? 8 : 10}
            onMouseMove={(e) => {
              if (e.activeTooltipIndex !== undefined) {
                setActiveIndex(e.activeTooltipIndex)
              }
            }}
            onMouseLeave={handleBarMouseLeave}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              vertical={false} 
              stroke="hsl(var(--border))" 
              opacity={isHovered ? 0.5 : 0.3}
            />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ 
                fontSize: 10, 
                fill: isHovered ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))'
              }} 
              className="transition-all duration-300"
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{
                fontSize: 10,
                fill: isHovered ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))'
              }}
              tickFormatter={(value) => `${Math.round(value / 1000)}k`}
              className="transition-all duration-300"
            />
            <Tooltip
              contentStyle={chartTooltipStyle}
              labelStyle={chartTooltipLabelStyle}
              itemStyle={chartTooltipItemStyle}
              formatter={(value: number) => [formatCurrency(value), "Total"]}
              animationDuration={300}
              animationEasing="ease-out"
            />
            <Bar 
              dataKey="value" 
              radius={[6, 6, 0, 0]}
              barSize={22}
              onMouseEnter={handleBarMouseEnter}
              onMouseLeave={handleBarMouseLeave}
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
                    strokeWidth={isHoveredBar ? 1.5 : 0}
                    opacity={isHovered && activeIndex !== null && activeIndex !== index ? chartOpacity.muted : chartOpacity.default}
                    className="transition-all duration-300"
                  />
                )
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* {isHovered && (
        <div className="mt-2 text-xs text-muted-foreground text-center animate-fade-in">
          {activeIndex !== null ? (
            <span className="font-medium">
              {data[activeIndex].name}: <span className="text-foreground font-bold">{data[activeIndex].value.toLocaleString()}</span> ventas
            </span>
          ) : (
            "Desplázate sobre las barras para ver detalles • Click para ampliar"
          )}
        </div>
      )} */}
    </div>
  )
}
