"use client"

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { chartPalette, chartTooltipStyle, chartTooltipLabelStyle, chartTooltipItemStyle } from "@/components/sugerencias/wanda/chart-theme"

const data = [
  { name: "Ene", value: 1.0002 },
  { name: "Feb", value: 1.0070 },
  { name: "Mar", value: 1.0080 },
  { name: "Abr", value: 1.0090 },
  { name: "May", value: 1.0080 },
  { name: "Jun", value: 1.0070 },
  { name: "Jul", value: 1.0070 },
  { name: "Ago", value: 1.0089 },
  { name: "Sep", value: 1.0096 },
  { name: "Oct", value: 1.0068 },
  { name: "Nov", value: 1.0061 },
  { name: "Dic", value: 1.0067 },
]

/**
 * @description Area chart con indice de frecuencia de compra mensual.
 * @returns {JSX.Element} Grafico de frecuencia mensual.
 */
export function MonthlyFrequencyChart() {
  return (
    <div className="flex flex-col h-full w-full bg-card text-card-foreground p-4 rounded-lg border shadow-sm">
      <div className="flex flex-col space-y-1 mb-4">
        <h3 className="text-sm font-semibold">Indice de Frecuencia de Compra Mensual</h3>
        <p className="text-xs text-muted-foreground">Comportamiento anual</p>
      </div>
      
      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorFrequency" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartPalette.accentSecondary} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={chartPalette.accentSecondary} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
            />
            <YAxis 
                domain={['auto', 'auto']} 
                hide 
            />
            <Tooltip 
              contentStyle={chartTooltipStyle}
              labelStyle={chartTooltipLabelStyle}
              itemStyle={chartTooltipItemStyle}
              formatter={(value: number) => [value.toFixed(4), "Indice"]}
              animationDuration={300}
              animationEasing="ease-out"
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={chartPalette.accentSecondary}
              fill="url(#colorFrequency)" 
              strokeWidth={2}
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between items-center text-xs mt-4 pt-4 border-t border-border">
         <div className="flex flex-col">
            <span className="text-muted-foreground">Valor Máximo</span>
            <span className="font-bold" style={{ color: chartPalette.accentSecondary }}>1.0096</span>
         </div>
         <div className="flex flex-col text-right">
            <span className="text-muted-foreground">Valor Mínimo</span>
            <span className="font-bold" style={{ color: chartPalette.alert }}>1.0061</span>
         </div>
      </div>
    </div>
  )
}
