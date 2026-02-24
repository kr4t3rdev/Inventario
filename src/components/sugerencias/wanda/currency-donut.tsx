
"use client"

import { useState } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Sector, Tooltip } from "recharts"
import { chartOpacity, chartTooltipItemStyle, chartTooltipLabelStyle, chartTooltipStyle, formatCurrency, getChartColor } from "@/components/sugerencias/wanda/chart-theme"

interface CurrencyData {
  codigo: string
  nombre: string
  simbolo: string
  total: number
  color: string
}

interface CurrencyDonutProps {
  data: CurrencyData[]
}

/**
 * @description Render del segmento activo para el donut.
 * @param {any} props - Props del segmento activo.
 * @returns {JSX.Element} Sector resaltado.
 */
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, strokeWidth, stroke } = props

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 3}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke={stroke || "white"}
        strokeWidth={strokeWidth || 1.5}
        className="transition-all duration-300"
      />
    </g>
  )
}

/**
 * @description Donut por monedas para total de facturación.
 * @param {CurrencyDonutProps} props - Props del componente.
 * @returns {JSX.Element} Donut con leyenda y total.
 */
export function CurrencyDonut({ data }: CurrencyDonutProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const handleMouseEnter = () => setIsHovered(true)
  const handleMouseLeave = () => {
    setIsHovered(false)
    setActiveIndex(null)
  }

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index)
  }

  const onPieLeave = () => {
    setActiveIndex(null)
  }

  const totalValue = data.reduce((sum, item) => sum + item.total, 0)

  const chartData = data.map((item, index) => ({
    name: item.codigo,
    value: item.total,
    color: getChartColor(index)
  }))

  return (
    <div 
      className="flex flex-col w-full bg-card text-card-foreground p-4 rounded-lg border shadow-sm transition-all duration-300 hover:shadow-lg cursor-pointer group motion-reduce:transition-none"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >   
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Total Facturación</h3>
        </div>
      </div>
      <div className="h-[120px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={chartTooltipStyle}
              labelStyle={chartTooltipLabelStyle}
              itemStyle={chartTooltipItemStyle}
              formatter={(value: number) => [formatCurrency(value), "Total"]}
              animationDuration={300}
              animationEasing="ease-out"
            />
            <Pie
              data={chartData}
              cx="50%"
              cy="45%"
              innerRadius={28}
              outerRadius={46}
              paddingAngle={3}
              dataKey="value"
              onMouseEnter={onPieEnter}
              onMouseLeave={onPieLeave}
              activeIndex={activeIndex !== null ? activeIndex : undefined}
              activeShape={activeIndex !== null ? renderActiveShape : undefined}
              animationDuration={300}
              animationEasing="ease-out"
              cornerRadius={6}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color} 
                  strokeWidth={activeIndex === index ? 1 : 0}
                  stroke="white"
                  opacity={activeIndex !== null && activeIndex !== index ? chartOpacity.muted : chartOpacity.default}
                  className="transition-all duration-300"
                />
              ))}
            </Pie>
            <Legend
              layout="horizontal"
              verticalAlign="bottom" 
              align="center"
              height={20} 
              iconType="circle" 
              iconSize={8}
              wrapperStyle={{ fontSize: '10px' }}
              formatter={(value: string) => (
                <span className={`text-xs transition-all duration-300 ${
                  activeIndex !== null && chartData[activeIndex]?.name === value ? 'font-bold text-foreground' : 'text-muted-foreground'
                }`}>
                  {value}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
           <span className="text-[10px] font-semibold text-muted-foreground">Total</span>
            <span className={`text-sm font-bold transition-all duration-300 ${isHovered ? "scale-[1.03]" : ""}`}>
              ${totalValue.toLocaleString()}
            </span>
        </div>
      </div>
      {/* {isHovered && (
        <div className="mt-2 text-xs text-muted-foreground text-center animate-fade-in">
          {activeIndex !== null ? (
            <span className="font-medium">
              {data[activeIndex].name}: <span className="text-foreground font-bold">${data[activeIndex].value.toLocaleString()}</span> ({((data[activeIndex].value / totalValue) * 100).toFixed(1)}%)
            </span>
          ) : (
            "Desplázate sobre los segmentos para ver detalles • Click para ampliar"
          )}
        </div>
      )} */}
    </div>
  )
}
