
"use client"

import { useState } from "react"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import { Eye } from "lucide-react"

interface GaugeChartProps {
  value: number
  label: string
  color: string
  total: number
  cantidad: number
}

/**
 * @description Componente de gauge para mostrar porcentajes por canal.
 * @param {GaugeChartProps} props - Props del componente.
 * @returns {JSX.Element} Gauge con porcentaje y total.
 */
export function GaugeChart({ value, label, color, total, cantidad }: GaugeChartProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isClicked, setIsClicked] = useState(false)

  const data = [
    { name: "Value", value: value },
    { name: "Remaining", value: 100 - value },
  ]

  const handleMouseEnter = () => setIsHovered(true)
  const handleMouseLeave = () => setIsHovered(false)
  const handleClick = () => {
    setIsClicked(true)
    setTimeout(() => setIsClicked(false), 300)
  }

  return (
    <div 
      className="flex flex-col items-center justify-center cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <div 
        className={`relative h-[120px] w-[120px] transition-all duration-300 ease-out motion-reduce:transition-none motion-reduce:transform-none ${
          isHovered ? "scale-[1.04]" : "scale-100"
        } ${isClicked ? "scale-[0.98]" : ""}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={isHovered ? 36 : 40}
              outerRadius={isHovered ? 60 : 56}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              stroke="none"
              animationDuration={500}
              animationBegin={0}
            >
              <Cell 
                key="cell-0" 
                fill={color} 
                stroke={isHovered ? "white" : "none"}
                strokeWidth={isHovered ? 2 : 0}
              />
              <Cell 
                key="cell-1" 
                fill="hsl(var(--muted))" 
                opacity={isHovered ? 0.7 : 1}
              />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span 
            className={`text-xl font-bold transition-all duration-300 ${
              isHovered ? "text-foreground scale-125" : "text-foreground"
            }`}
          >
            {value}%
          </span>
          <span className="text-xs text-muted-foreground">${total.toLocaleString()}</span>
        </div>
        {isHovered && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center animate-pulse">
            <Eye className="h-3 w-3 text-primary-foreground" aria-hidden="true" />
          </div>
        )}
      </div>
      <span 
        className={`mt-2 text-sm font-medium transition-all duration-300 ${
          isHovered ? "text-foreground font-bold" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
      {isHovered && (
        <div className="mt-1 text-xs text-muted-foreground animate-fade-in">
          Click para detalles
        </div>
      )}
    </div>
  )
}
