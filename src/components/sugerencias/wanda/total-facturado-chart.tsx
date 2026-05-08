
"use client"

import { useState } from "react"
import { LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { TrendingUp, TrendingDown, ZoomIn } from "lucide-react"
import { chartPalette, chartTooltipStyle, chartTooltipLabelStyle, chartTooltipItemStyle, formatCurrency } from "@/components/sugerencias/wanda/chart-theme"

interface DataPoint {
  fecha: string
  total: number
  acumulado: number
}

interface TotalFacturadoChartProps {
  data: DataPoint[]
  tendencia: number
}

/**
 * @description Componente de línea para total facturado mensual.
 * @param {TotalFacturadoChartProps} props - Props del componente.
 * @returns {JSX.Element} Línea con tendencia y detalles.
 */
export function TotalFacturadoChart({ data, tendencia }: TotalFacturadoChartProps) {
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseEnter = () => setIsHovered(true)
  const handleMouseLeave = () => setIsHovered(false)

  const minValue = Math.min(...data.map(d => d.total))
  const maxValue = Math.max(...data.map(d => d.total))
  const minMonth = data.find(d => d.total === minValue)?.fecha || ''
  const maxMonth = data.find(d => d.total === maxValue)?.fecha || ''

  const chartData = data.map(d => ({
    name: d.fecha,
    value: d.total
  }))

  return (
    <div 
      className="flex flex-col w-full bg-card text-card-foreground p-4 rounded-lg border shadow-sm transition-all duration-300 hover:shadow-lg cursor-pointer group motion-reduce:transition-none"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Total Facturado por Mes</h3>
          {isHovered && (
            <ZoomIn className="h-3 w-3 text-muted-foreground animate-pulse-subtle" />
          )}
        </div>
        <div className="flex gap-4">
          <div className="flex flex-col items-end">
            <span
              className={`flex items-center text-xs font-bold transition-all duration-300 ${isHovered ? "scale-105" : ""}`}
              style={{ color: chartPalette.alert }}
            >
              <TrendingDown className="h-3 w-3 mr-1" /> ${minValue.toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground">Min: {minMonth}</span>
          </div>
          <div className="flex flex-col items-end">
            <span
              className={`flex items-center text-xs font-bold transition-all duration-300 ${isHovered ? "scale-105" : ""}`}
              style={{ color: chartPalette.accentSecondary }}
            >
              <TrendingUp className="h-3 w-3 mr-1" /> ${maxValue.toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground">Max: {maxMonth}</span>
          </div>
        </div>
      </div>
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <defs>
              <linearGradient id="totalFacturadoFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartPalette.accentPrimary} stopOpacity={0.28} />
                <stop offset="95%" stopColor={chartPalette.accentPrimary} stopOpacity={0.02} />
              </linearGradient>
            </defs>
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
              tickFormatter={(value) => `${value / 1000}k`}
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
            <Area
              type="monotone"
              dataKey="value"
              stroke="none"
              fill="url(#totalFacturadoFill)"
              animationDuration={500}
              animationEasing="ease-out"
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={chartPalette.accentPrimary}
              strokeWidth={isHovered ? 3 : 2}
              dot={{ 
                r: isHovered ? 4 : 3,
                fill: chartPalette.accentPrimary,
                strokeWidth: 0,
                className: "transition-all duration-300"
              }}
              activeDot={{ 
                r: 8, 
                fill: chartPalette.accentPrimary,
                stroke: "white",
                strokeWidth: 2,
                className: "transition-all duration-300 animate-pulse-subtle"
              }}
              animationDuration={500}
              animationEasing="ease-out"
              className="transition-all duration-300"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {isHovered && (
        <div className="mt-2 text-xs text-muted-foreground text-center animate-fade-in">
          Desplázate sobre los puntos para ver detalles • Click para ampliar
        </div>
      )}
    </div>
  )
}
