
"use client"

import { useState } from "react"
import { Moon, Sun } from "lucide-react"
import { formatHoursMinutes, getChartColor, withHoursLabel } from "@/components/sugerencias/wanda/chart-theme"

interface ShiftData {
  turno: string
  inicio: number
  fin: number
  total: number
  cantidad: number
  color: string
}

interface ShiftBillingBarChartProps {
  data: ShiftData[]
}

/**
 * @description Barras horizontales por turno con facturación.
 * @param {ShiftBillingBarChartProps} props - Props del componente.
 * @returns {JSX.Element} Barras con métricas por turno.
 */
export function ShiftBillingBarChart({ data }: ShiftBillingBarChartProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const handleMouseEnter = () => setIsHovered(true)
  const handleMouseLeave = () => {
    setIsHovered(false)
    setActiveIndex(null)
  }

  const handleBarMouseEnter = (index: number) => {
    setActiveIndex(index)
  }

  const handleBarMouseLeave = () => {
    setActiveIndex(null)
  }

  const maxValue = Math.max(...data.map(d => d.total))
  const totalValue = data.reduce((sum, item) => sum + item.total, 0)

  return (
    <div 
      className="flex flex-col h-full w-full bg-card text-card-foreground p-4 rounded-lg border shadow-sm transition-all duration-300 hover:shadow-lg cursor-pointer group motion-reduce:transition-none"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <div>
            <h3 className="text-sm font-semibold">Total Facturación Por Turno</h3>
            <p className="text-xs text-muted-foreground">Facturación Anual</p>
          </div>
          {isHovered && (
            <Moon className="h-3 w-3 text-muted-foreground animate-pulse-subtle" />
          )}
        </div>
        {/* <div className={`h-4 w-4 rounded-full bg-muted border-2 transition-all duration-300 ${isHovered ? "border-foreground/40" : "border-foreground/20"}`}></div>*/}
      </div> 

      <div className="flex-1 flex flex-col justify-center space-y-4">
        {data.map((item, index) => {
          const isActive = activeIndex === index
          const percentage = (item.total / maxValue) * 100
          const percentageOfTotal = (item.total / totalValue) * 100
          
          return (
            <div 
              key={item.turno}
              className="transition-all duration-300"
              onMouseEnter={() => handleBarMouseEnter(index)}
              onMouseLeave={handleBarMouseLeave}
            >
              <div className="flex justify-between text-xs mb-1">
                <span className={`font-semibold transition-all duration-300 ${isActive ? "text-foreground scale-105" : ""}`}>
                  {item.turno} ({withHoursLabel(formatHoursMinutes(item.inicio))} - {withHoursLabel(formatHoursMinutes(item.fin))})
                </span>
                <span className={`font-bold transition-all duration-300 ${isActive ? "text-foreground scale-105" : ""}`}>
                  ${item.total.toLocaleString()}
                </span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden relative">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ease-out ${
                    isActive ? "shadow-md" : ""
                  }`}
                  style={{ 
                    width: `${isHovered && isActive ? Math.min(percentage + 2, 100) : percentage}%`,
                    backgroundColor: getChartColor(index),
                    transition: 'width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  }}
                >
                  {isActive && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  )}
                </div>
                {isHovered && (
                  <div className="absolute -top-5 right-0 text-[10px] text-muted-foreground">
                    {percentageOfTotal.toFixed(1)}%
                  </div>
                )}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>{item.cantidad.toLocaleString()} transacciones</span>
                {isActive && (
                  <span className="flex items-center gap-1 animate-fade-in">
                    {index === 0 ? (
                      <>
                        <Moon className="h-3 w-3" aria-hidden="true" />
                        Turno de tarde
                      </>
                    ) : (
                      <>
                        <Sun className="h-3 w-3" aria-hidden="true" />
                        Turno de día
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      
      {/* {isHovered && (
        <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground text-center animate-fade-in">
          {activeIndex !== null ? (
            <div className="font-medium">
              <span className="text-foreground font-bold">{data[activeIndex].turno}</span>:{" "}
              <span className="text-foreground">${data[activeIndex].total.toLocaleString()}</span> (
              {((data[activeIndex].total / totalValue) * 100).toFixed(1)}% del total)
            </div>
          ) : (
            "Desplázate sobre las barras para ver detalles"
          )}
        </div>
      )} */}
    </div>
  )
}
