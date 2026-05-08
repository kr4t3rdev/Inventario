
"use client"

import { useState } from "react"
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Dot } from "lucide-react"
import { chartPalette, chartOpacity, chartTooltipStyle, chartTooltipLabelStyle, chartTooltipItemStyle, formatCurrency, getChartColor } from "@/components/sugerencias/wanda/chart-theme"

interface ChannelData {
  canal: string
  monto: number
  cantidad: number
  valorNormalizado: number
  color: string
}

interface PaymentChannelDotPlotProps {
  data: ChannelData[]
}

/**
 * @description Dot plot por canal de pago para monto y volumen.
 * @param {PaymentChannelDotPlotProps} props - Props del componente.
 * @returns {JSX.Element} Scatter con tamaño por cantidad.
 */
export function PaymentChannelDotPlot({ data }: PaymentChannelDotPlotProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const handleMouseEnter = () => setIsHovered(true)
  const handleMouseLeave = () => {
    setIsHovered(false)
    setActiveIndex(null)
  }

  const maxCantidad = Math.max(...data.map(d => d.cantidad))

  const chartData = data.map((d, index) => ({
    x: d.canal,
    y: d.monto,
    cantidad: d.cantidad,
    color: getChartColor(index)
  }))

  return (
    <div 
      className="flex flex-col h-full w-full bg-card text-card-foreground p-4 rounded-lg border shadow-sm transition-all duration-300 hover:shadow-lg cursor-pointer group motion-reduce:transition-none"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex justify-between items-start mb-2">
         <div className="flex items-center gap-2">
            <div>
              <h3 className="text-sm font-semibold">Total Facturado</h3>
              <p className="text-xs text-muted-foreground">Canal de pago efectivo</p>
            </div>
            {isHovered && (
              <Dot className="h-3 w-3 text-muted-foreground animate-pulse-subtle" />
            )}
         </div>
         {/* <div className="flex gap-2 text-[10px] text-muted-foreground">
            <span className={`flex items-center transition-all duration-300 ${isHovered ? "text-foreground font-medium" : ""}`}>
              <span className="w-2 h-2 rounded-full bg-purple-700 mr-1"></span> Máxima
            </span>
            <span className={`flex items-center transition-all duration-300 ${isHovered ? "text-foreground font-medium" : ""}`}>
              <span className="w-2 h-2 rounded-full bg-red-500 mr-1"></span> Mínima
            </span>
         </div> */}
      </div>
      <div className="flex-1 h-[90px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart
            margin={{ top: 10, right: 10, bottom: 0, left: -20 }}
            onMouseMove={(e) => {
              if (e.activeTooltipIndex !== undefined) {
                setActiveIndex(e.activeTooltipIndex)
              }
            }}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              vertical={false} 
              stroke={chartPalette.neutral} 
              strokeOpacity={isHovered ? 0.3 : 0.2}
              className="transition-all duration-300"
            />
            <XAxis 
              dataKey="x" 
              type="category" 
              axisLine={false} 
              tickLine={false} 
              tick={{ 
                fontSize: 10, 
                fill: isHovered ? 'hsl(var(--foreground))' : chartPalette.neutral
              }} 
              className="transition-all duration-300"
            />
            <YAxis 
              dataKey="y" 
              type="number" 
              axisLine={false} 
              tickLine={false} 
              tick={{ 
                fontSize: 8, 
                fill: isHovered ? 'hsl(var(--foreground))' : chartPalette.neutral
              }} 
              domain={['dataMin - 1000', 'dataMax + 1000']}
              tickFormatter={(value) => `${Math.round(value / 1000)}k`}
              className="transition-all duration-300"
            />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3', stroke: chartPalette.neutral }} 
              contentStyle={chartTooltipStyle}
              labelStyle={chartTooltipLabelStyle}
              itemStyle={chartTooltipItemStyle}
              formatter={(value: number) => [formatCurrency(value), "Monto"]}
              animationDuration={300}
              animationEasing="ease-out"
            />
            <Scatter 
              name="Facturado" 
              data={chartData} 
              shape={(props: any) => {
                const { cx, cy, index } = props
                const isActive = activeIndex === index
                const pointData = chartData[index]
                const baseSize = 6
                const sizeScale = maxCantidad > 0 ? (pointData?.cantidad / maxCantidad) : 0
                const size = baseSize + sizeScale * 8 + (isActive ? 2 : 0)
                
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? size + 1 : size}
                    fill={pointData?.color || getChartColor(index)}
                    stroke={isActive ? "white" : "none"}
                    strokeWidth={isActive ? 2 : 0}
                    opacity={isHovered && activeIndex !== null && activeIndex !== index ? chartOpacity.muted : chartOpacity.default}
                    className="transition-all duration-300"
                  />
                )
              }}
              animationDuration={500}
              animationEasing="ease-out"
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {/* {isHovered && (
        <div className="mt-2 text-xs text-muted-foreground text-center animate-fade-in">
          {activeIndex !== null ? (
            <span className="font-medium">
              {data[activeIndex].x}: <span className="text-foreground font-bold">${data[activeIndex].y.toLocaleString()}</span>
              {data[activeIndex].y === maxValue && " (Máximo)"}
              {data[activeIndex].y === minValue && " (Mínimo)"}
            </span>
          ) : (
            "Desplázate sobre los puntos para ver detalles • Click para ampliar"
          )}
        </div>
      )} */}
    </div>
  )
}
