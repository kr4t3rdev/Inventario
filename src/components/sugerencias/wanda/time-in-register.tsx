
"use client"

import { useState } from "react"
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts"
import { Clock } from "lucide-react"
import { chartPalette, chartTooltipItemStyle, chartTooltipLabelStyle, chartTooltipStyle, formatHoursMinutes, getChartColor, withHoursLabel } from "@/components/sugerencias/wanda/chart-theme"

interface EmpleadoTiempo {
  empleadoId: string
  nombre: string
  horasTotales: number
  diasTrabajados: number
  promedioDiario: number
}

interface TimeInRegisterProps {
  empleados: EmpleadoTiempo[]
  totalHoras: number
  promedioGeneral: number
}

interface TimeCardProps {
  title: string
  avgTime: string
  minTime?: string
  color: string
  data: { name: string; value: number }[]
}

/**
 * @description Obtiene un color para las mini series del componente.
 * @param {number} index - Indice del elemento.
 * @returns {string} Color hexadecimal.
 */
const generateColor = (index: number): string => {
  return getChartColor(index)
}

/**
 * @description Card de tiempo promedio por empleado.
 * @param {TimeCardProps} props - Props del componente.
 * @returns {JSX.Element} Tarjeta de tiempo con mini area chart.
 */
function TimeCard({ title, avgTime, minTime = "0 min", color, data }: TimeCardProps) {
  const minSeriesValue = Math.min(...data.map((item) => item.value))

  return (
     <div className="bg-muted/20 border rounded p-2 flex flex-col gap-1 transition-all duration-300 hover:bg-muted/30 hover:scale-[1.02] cursor-pointer">
      <div className="flex justify-between items-start">
        <span className="text-[10px] font-bold text-foreground w-2/3 leading-tight">{title}</span>
        <div className="h-8 w-2/3">
           <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
               <Tooltip
                 contentStyle={chartTooltipStyle}
                 labelStyle={chartTooltipLabelStyle}
                 itemStyle={chartTooltipItemStyle}
                 formatter={(value: number) => [formatHoursMinutes(value), "Tiempo"]}
                 animationDuration={300}
                 animationEasing="ease-out"
               />
               <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.2} strokeWidth={2} animationDuration={500} animationEasing="ease-out" activeDot={{ r: 3, stroke: "white", strokeWidth: 1 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="flex justify-between items-end">
        <div>
           <div className="text-xs font-bold text-foreground">{minTime}</div>
           <div className="text-[8px] text-muted-foreground">Promedio</div>
        </div>
        <div className="text-right">
             <div className="text-[8px] text-muted-foreground">Comportamiento Anual</div>
        </div>
      </div>
       <div className="flex justify-between items-center text-[10px] border-t border-border pt-1 mt-1">
          <span className="font-bold" style={{ color: chartPalette.accentSecondary }}>{avgTime}</span>
          <span className="font-bold" style={{ color: chartPalette.alert }}>
            {formatHoursMinutes(minSeriesValue)}
          </span>
       </div>
    </div>
  )
}

/**
 * @description Muestra el tiempo promedio por empleado y el promedio general.
 * @param {TimeInRegisterProps} props - Props del componente.
 * @returns {JSX.Element} Tarjeta con tiempos y mini charts.
 */
export function TimeInRegister({ empleados, totalHoras, promedioGeneral }: TimeInRegisterProps) {
  const [isHovered, setIsHovered] = useState(false)

  /**
   * @description Construye un dataset base para sparkline en horas.
   * @param {number} baseHours - Horas base en formato decimal.
   * @returns {{ name: string; value: number }[]} Serie de tiempo simulada.
   */
  const buildSparkData = (baseHours: number) => {
    const multipliers = [0.9, 1.05, 0.95, 1.1, 1.0, 0.92]
    return multipliers.map((multiplier, index) => ({
      name: String(index + 1),
      value: Math.max(0.05, baseHours * multiplier)
    }))
  }

  const chartData = buildSparkData(promedioGeneral)

  return (
    <div 
      className="flex flex-col h-full w-full bg-card text-card-foreground p-4 rounded-lg border shadow-sm space-y-4 transition-all duration-300 hover:shadow-lg cursor-pointer group justify-between"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-semibold">Tiempo del Cliente en Caja</h3>
          <p className="text-xs text-muted-foreground">Promedio por empleado</p>
        </div>
         <Clock className="h-4 w-4 transition-all duration-300 group-hover:scale-125 group-hover:rotate-12" style={{ color: chartPalette.accentSecondary }} />
      </div>

      <div className="space-y-3">
        {empleados.slice(0, 3).map((empleado, index) => (
          <TimeCard 
            key={empleado.empleadoId}
            title={empleado.nombre} 
            avgTime={withHoursLabel(formatHoursMinutes(empleado.promedioDiario))}
            minTime={`${empleado.diasTrabajados} días`}
            color={generateColor(index)}
            data={buildSparkData(empleado.promedioDiario)}
          />
        ))}
      </div>

      <div className="pt-2 border-t border-border">
        <h4 className="text-xs font-semibold mb-1">Promedio Tiempo Cliente en Caja</h4>
        <p className="text-[10px] text-muted-foreground mb-2">Total: {withHoursLabel(formatHoursMinutes(totalHoras))}</p>
        <div className="flex items-center gap-4">
           <div className="text-xl font-bold" style={{ color: chartPalette.accentPrimary }}>
             {withHoursLabel(formatHoursMinutes(promedioGeneral))}
           </div>
           <div className="h-8 flex-1">
             <ResponsiveContainer width="100%" height="50%">
                <AreaChart data={chartData}>
                   <Tooltip
                     contentStyle={chartTooltipStyle}
                     labelStyle={chartTooltipLabelStyle}
                     itemStyle={chartTooltipItemStyle}
                     formatter={(value: number) => [formatHoursMinutes(value), "Tiempo"]}
                     animationDuration={300}
                     animationEasing="ease-out"
                   />
                   <Area
                     type="monotone"
                     dataKey="value"
                     stroke={chartPalette.accentPrimary}
                     fill={chartPalette.accentPrimary}
                     fillOpacity={0.1}
                     strokeWidth={2}
                     animationDuration={500}
                     animationEasing="ease-out"
                     activeDot={{ r: 3, stroke: "white", strokeWidth: 1 }}
                   />
                </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>
        <div className="text-[10px] text-muted-foreground">Promedio General</div>
      </div>

    </div>
  )
}
