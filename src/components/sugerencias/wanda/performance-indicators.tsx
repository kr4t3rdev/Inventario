
"use client"

import { BarChart, Bar, XAxis, ResponsiveContainer, AreaChart, Area, Tooltip } from "recharts"
import { Users, UserCheck, Smartphone, Crown } from "lucide-react"
import { chartOpacity, chartPalette, formatCount, formatPercent, chartTooltipStyle, chartTooltipLabelStyle, chartTooltipItemStyle } from "@/components/sugerencias/wanda/chart-theme"

interface TooltipProps {
  active?: boolean
  payload?: Array<{
    value: number
    dataKey: string
    color: string
  }>
  label?: string
}

function BarTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const totalVentas = payload.find(p => p.dataKey === 'totalVentas')?.value || 0
  const reconciliadas = payload.find(p => p.dataKey === 'reconciliadas')?.value || 0
  const eficiencia = totalVentas > 0 ? (reconciliadas / totalVentas) * 100 : 0

  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 text-xs">
      <div className="font-semibold text-foreground mb-2 border-b pb-1">{label}</div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: chartPalette.accentPrimary }} />
            <span className="text-muted-foreground">Total Ventas</span>
          </span>
          <span className="font-semibold">{formatCount(totalVentas)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: chartPalette.accentSecondary }} />
            <span className="text-muted-foreground">Reconciliadas</span>
          </span>
          <span className="font-semibold">{formatCount(reconciliadas)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 pt-1 border-t mt-1">
          <span className="text-muted-foreground">Eficiencia</span>
          <span className="font-bold" style={{ color: chartPalette.accentSecondary }}>
            {formatPercent(eficiencia, 1)}
          </span>
        </div>
      </div>
    </div>
  )
}

function AreaTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const value = payload[0]?.value || 0

  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 text-xs">
      <div className="font-semibold text-foreground mb-1">{label}</div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: chartPalette.alert }} />
        <span className="text-muted-foreground">Eficiencia:</span>
        <span className="font-bold" style={{ color: chartPalette.alert }}>
          {formatPercent(value, 1)}
        </span>
      </div>
    </div>
  )
}

interface EficienciaPuntoVenta {
  puntoVenta: string
  totalVentas: number
  reconciliadas: number
  eficiencia: number
}

interface PerformanceIndicatorsProps {
  tasaConversion: number
  promedioReconciliacionesDiarias: number
  totalReconciliaciones: number
  eficienciaPorPuntoVenta: EficienciaPuntoVenta[]
  diasAnalizados: number
}

/**
 * @description Indicadores de rendimiento y mini charts por punto de venta.
 * @param {PerformanceIndicatorsProps} props - Props del componente.
 * @returns {JSX.Element} Panel de indicadores y gráficos.
 */
export function PerformanceIndicators({
  tasaConversion,
  promedioReconciliacionesDiarias,
  totalReconciliaciones,
  eficienciaPorPuntoVenta,
  diasAnalizados
}: PerformanceIndicatorsProps) {
  return (
    <div 
      className="flex flex-col h-full w-full bg-card text-card-foreground p-4 rounded-lg border shadow-sm space-y-4 transition-all duration-300 hover:shadow-lg cursor-pointer group justify-between motion-reduce:transition-none"
    >
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Indicadores de Rendimiento</h3>
         <Crown className="h-4 w-4 text-amber-500 transition-all duration-300 group-hover:scale-125 group-hover:rotate-12" aria-hidden="true" />
      </div>

      <div className="flex gap-4">
        {/* Placeholder for Image */}
           <div className="w-1/2 bg-gray-100 dark:bg-muted/40 rounded-lg flex flex-col items-center justify-center p-4 text-center min-h-[120px] transition-all duration-300 group-hover:opacity-90">
          <div className="bg-gray-200 dark:bg-muted p-2 rounded-full mb-2">
             <Smartphone className="h-6 w-6 text-gray-400 dark:text-muted-foreground" />
          </div>
          <span className="text-xs text-muted-foreground font-medium">CONTENIDO NO DISPONIBLE</span>
        </div>

        {/* Metrics */}
        <div className="w-1/2 flex flex-col justify-between space-y-2">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Clientes Totales</div>
             <div
               className="text-white text-xs font-bold px-2 py-1 rounded inline-block transition-all duration-300 group-hover:scale-105"
               style={{ backgroundColor: chartPalette.accentPrimary }}
             >
               {totalReconciliaciones.toLocaleString()}
             </div>
          </div>
          
          <div className="text-right">
             <div className="text-xs text-muted-foreground">Tasa Conversión</div>
             <div className="text-sm font-bold text-foreground">{(tasaConversion * 100).toFixed(2)}%</div>
          </div>

          <div className="text-right">
            <div className="text-xs text-muted-foreground">Promedio Diario</div>
             <div
               className="text-white text-xs font-bold px-2 py-1 rounded inline-block transition-all duration-300 group-hover:scale-105"
               style={{ backgroundColor: chartPalette.accentSecondary }}
             >
               {promedioReconciliacionesDiarias.toLocaleString()}
             </div>
          </div>
        </div>
      </div>

      {/* Bar Chart Section */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-semibold">Eficiencia por Punto de Venta</span>
          <div className="flex gap-2">
             <div className="flex items-center text-xs font-bold" style={{ color: chartPalette.accentPrimary }}>
                <Users className="h-3 w-3 mr-1" /> {eficienciaPorPuntoVenta.reduce((sum, p) => sum + p.totalVentas, 0).toLocaleString()}
             </div>
             <div className="flex items-center text-xs font-bold" style={{ color: chartPalette.accentSecondary }}>
                <UserCheck className="h-3 w-3 mr-1" /> {eficienciaPorPuntoVenta.reduce((sum, p) => sum + p.reconciliadas, 0).toLocaleString()}
             </div>
          </div>
        </div>
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={eficienciaPorPuntoVenta}>
              <Tooltip
                content={<BarTooltip />}
                cursor={{ fill: 'transparent' }}
                animationDuration={300}
                animationEasing="ease-out"
              />
               <Bar
                 dataKey="totalVentas"
                 fill={chartPalette.accentPrimary}
                 radius={[2, 2, 0, 0]}
                 fillOpacity={chartOpacity.default}
                 animationDuration={500}
                 animationEasing="ease-out"
                 activeBar={{ fill: chartPalette.accentPrimary, stroke: "white", strokeWidth: 1 }}
               />
               <Bar
                 dataKey="reconciliadas"
                 fill={chartPalette.accentSecondary}
                 radius={[2, 2, 0, 0]}
                 fillOpacity={chartOpacity.default}
                 animationDuration={500}
                 animationEasing="ease-out"
                 activeBar={{ fill: chartPalette.accentSecondary, stroke: "white", strokeWidth: 1 }}
               />
              <XAxis dataKey="puntoVenta" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} interval={0} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">Ventas Totales / Reconciliadas por PV</div>
      </div>

      {/* Area Chart Section */}
      <div>
         <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-semibold">Índice de Frecuencia de Compra ({diasAnalizados} días)</span>
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mb-2">
             <span>
               Promedio{' '}
               <span className="font-bold" style={{ color: chartPalette.accentSecondary }}>
                 ▲ {promedioReconciliacionesDiarias.toFixed(2)}
               </span>
             </span>
             <span>
               <span className="font-bold" style={{ color: chartPalette.alert }}>
                 ▼ {diasAnalizados}
               </span>{' '}
               Días analizados
             </span>
        </div>
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={eficienciaPorPuntoVenta.map(p => ({ name: p.puntoVenta, value: p.eficiencia }))}>
              <Tooltip
                content={<AreaTooltip />}
                cursor={{ stroke: 'hsl(var(--muted))', strokeWidth: 1, strokeDasharray: '4 4' }}
                animationDuration={300}
                animationEasing="ease-out"
              />
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartPalette.alert} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={chartPalette.alert} stopOpacity={0}/>
                </linearGradient>
              </defs>
               <Area
                 type="monotone"
                 dataKey="value"
                 stroke={chartPalette.alert}
                 fillOpacity={1}
                 fill="url(#colorValue)"
                 strokeWidth={2}
                 animationDuration={500}
                 animationEasing="ease-out"
                 activeDot={{ r: 4, stroke: "white", strokeWidth: 1 }}
               />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }} interval={0} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  )
}
