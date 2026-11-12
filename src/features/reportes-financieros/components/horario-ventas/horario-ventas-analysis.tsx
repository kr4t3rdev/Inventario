"use client"

import { useMemo } from "react"
import { TrendingUp, TrendingDown, Clock, AlertTriangle, Lightbulb, BarChart3, Activity } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface HourlyData {
  hora: string
  total: number
  cantidad: number
}

interface HeatmapDay {
  dia: string
  horas: HourlyData[]
}

interface HorarioVentasAnalysisProps {
  barData: HourlyData[]
  heatmapData: HeatmapDay[]
}

/**
 * @description Componente de análisis detallado para el reporte de horario de ventas.
 * Calcula y muestra métricas clave como horas pico, períodos de baja actividad,
 * estadísticas resumidas y recomendaciones basadas en los patrones de ventas.
 * @param {HorarioVentasAnalysisProps} props - Props del componente
 * @param {HourlyData[]} props.barData - Datos de ventas por hora
 * @param {HeatmapDay[]} props.heatmapData - Datos de ventas por día y hora
 * @returns {JSX.Element} Panel de análisis detallado
 */
export function HorarioVentasAnalysis({ barData, heatmapData }: HorarioVentasAnalysisProps) {
  const analysis = useMemo(() => {
    if (barData.length === 0) return null

    // Calcular métricas básicas
    const totalVentas = barData.reduce((sum, h) => sum + h.cantidad, 0)
    const totalMonto = barData.reduce((sum, h) => sum + h.total, 0)
    const promedioPorHora = totalMonto / 24

    // Encontrar horas pico y bajas
    const sortedByAmount = [...barData].sort((a, b) => b.total - a.total)
    const sortedByCount = [...barData].sort((a, b) => b.cantidad - a.cantidad)

    const horaPicoMonto = sortedByAmount[0]
    const horaPicoCantidad = sortedByCount[0]

    // Horas con menos actividad (excluyendo las que tienen 0)
    const activeHours = barData.filter(h => h.cantidad > 0)
    const sortedLowActivity = [...activeHours].sort((a, b) => a.cantidad - b.cantidad)
    const horasBajas = sortedLowActivity.slice(0, 3)

    // Horas sin actividad
    const inactiveHours = barData.filter(h => h.cantidad === 0)

    // Calcular desviación estándar para identificar horas atípicas
    const montos = barData.map(h => h.total)
    const media = montos.reduce((sum, val) => sum + val, 0) / montos.length
    const varianza = montos.reduce((sum, val) => sum + Math.pow(val - media, 2), 0) / montos.length
    const desviacionEstandar = Math.sqrt(varianza)

    // Horas atípicas (más de 1 desviación estándar por encima de la media)
    const horasAtipicas = barData.filter(h => h.total > media + desviacionEstandar)

    // Calcular período efectivo de ventas (horas con al menos el 20% del promedio)
    const umbralActividad = promedioPorHora * 0.2
    const horasActivas = barData.filter(h => h.total >= umbralActividad)
    const primeraHoraActiva = horasActivas.length > 0 ? horasActivas[0].hora : "N/A"
    const ultimaHoraActiva = horasActivas.length > 0 ? horasActivas[horasActivas.length - 1].hora : "N/A"

    // Análisis por día de la semana
    const diasAnalysis = heatmapData.map(dia => {
      const totalDia = dia.horas.reduce((sum, h) => sum + h.total, 0)
      const cantidadDia = dia.horas.reduce((sum, h) => sum + h.cantidad, 0)
      const horaPicoDia = dia.horas.reduce((max, h) => h.total > max.total ? h : max, dia.horas[0])

      return {
        dia: dia.dia,
        total: totalDia,
        cantidad: cantidadDia,
        horaPico: horaPicoDia?.hora || "N/A",
        montoPico: horaPicoDia?.total || 0,
      }
    }).sort((a, b) => b.total - a.total)

    // Día más y menos activo
    const diaMasActivo = diasAnalysis[0]
    const diaMenosActivo = diasAnalysis[diasAnalysis.length - 1]

    // Recomendaciones basadas en los datos
    const recomendaciones: string[] = []

    if (inactiveHours.length > 8) {
      recomendaciones.push("Hay más de 8 horas sin ventas. Considera ajustar el horario de atención para optimizar costos operativos.")
    }

    if (horasBajas.length > 0 && horasBajas[0].cantidad < 5) {
      recomendaciones.push(`Las horas de menor actividad (${horasBajas.map(h => h.hora).join(", ")}) podrían beneficiarse de promociones o campañas de marketing.`)
    }

    if (horaPicoMonto && horaPicoCantidad) {
      recomendaciones.push(`La hora ${horaPicoMonto.hora} concentra el mayor monto de ventas. Asegura suficiente personal en este horario.`)
    }

    if (diasAnalysis.length > 0) {
      const variacionSemanal = ((diaMasActivo.total - diaMenosActivo.total) / diaMasActivo.total) * 100
      if (variacionSemanal > 50) {
        recomendaciones.push(`Existe una variación del ${variacionSemanal.toFixed(0)}% entre el día más y menos activo. Considera ajustar inventario y personal según el día.`)
      }
    }

    if (horasAtipicas.length > 0) {
      recomendaciones.push(`Las horas ${horasAtipicas.map(h => h.hora).join(", ")} muestran picos atípicos. Investiga si hay eventos o promociones que los generen.`)
    }

    return {
      totalVentas,
      totalMonto,
      promedioPorHora,
      horaPicoMonto,
      horaPicoCantidad,
      horasBajas,
      inactiveHours,
      horasAtipicas,
      primeraHoraActiva,
      ultimaHoraActiva,
      diasAnalysis,
      diaMasActivo,
      diaMenosActivo,
      recomendaciones,
      desviacionEstandar,
    }
  }, [barData, heatmapData])

  if (!analysis) {
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/10 p-6">
        <div className="text-center text-muted-foreground">
          No hay datos suficientes para generar el análisis
        </div>
      </div>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      {/* Métricas clave */}
      <div className="rounded-2xl border border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/10">
        <div className="p-4 pb-2">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Métricas Clave</h3>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Total de ventas</div>
                <div className="text-2xl font-bold">{analysis.totalVentas.toLocaleString('es-AR')}</div>
                <div className="text-xs text-muted-foreground">transacciones</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Monto total</div>
                <div className="text-2xl font-bold">{formatCurrency(analysis.totalMonto)}</div>
                <div className="text-xs text-muted-foreground">facturado</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Promedio por hora</div>
                <div className="text-2xl font-bold">{formatCurrency(analysis.promedioPorHora)}</div>
                <div className="text-xs text-muted-foreground">por hora</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Horas activas</div>
                <div className="text-2xl font-bold">{24 - analysis.inactiveHours.length}</div>
                <div className="text-xs text-muted-foreground">de 24 horas</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Horas pico y bajas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Horas pico */}
        <div className="rounded-2xl border border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/10">
          <div className="p-4 pb-2">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              <h3 className="text-sm font-medium">Horas Pico</h3>
            </div>
          </div>
          <div className="px-4 pb-4 space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
              <div>
                <div className="text-sm font-medium">Mayor monto</div>
                <div className="text-xs text-muted-foreground">{analysis.horaPicoMonto.hora}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(analysis.horaPicoMonto.total)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {analysis.horaPicoMonto.cantidad} ventas
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <div>
                <div className="text-sm font-medium">Mayor cantidad</div>
                <div className="text-xs text-muted-foreground">{analysis.horaPicoCantidad.hora}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {analysis.horaPicoCantidad.cantidad} ventas
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatCurrency(analysis.horaPicoCantidad.total)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Períodos de baja actividad */}
        <div className="rounded-2xl border border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/10">
          <div className="p-4 pb-2">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <h3 className="text-sm font-medium">Baja Actividad</h3>
            </div>
          </div>
          <div className="px-4 pb-4 space-y-3">
            {analysis.horasBajas.map((hora) => (
              <div key={hora.hora} className="flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <div>
                    <div className="text-sm font-medium">{hora.hora}</div>
                    <div className="text-xs text-muted-foreground">
                      {hora.cantidad} ventas
                    </div>
                  </div>
                </div>
                <div className="text-sm font-medium text-orange-600 dark:text-orange-400">
                  {formatCurrency(hora.total)}
                </div>
              </div>
            ))}
            {analysis.inactiveHours.length > 0 && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <div className="text-sm font-medium text-red-600 dark:text-red-400">
                    Horas sin actividad
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {analysis.inactiveHours.slice(0, 6).map((hora) => (
                    <Badge key={hora.hora} variant="outline" className="text-xs">
                      {hora.hora}
                    </Badge>
                  ))}
                  {analysis.inactiveHours.length > 6 && (
                    <Badge variant="outline" className="text-xs">
                      +{analysis.inactiveHours.length - 6} más
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Análisis semanal */}
      <div className="rounded-2xl border border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/10">
        <div className="p-4 pb-2">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Análisis Semanal</h3>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                <div className="text-xs text-muted-foreground mb-1">Día más activo</div>
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  {analysis.diaMasActivo.dia}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatCurrency(analysis.diaMasActivo.total)} • {analysis.diaMasActivo.cantidad} ventas
                </div>
              </div>
              <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                <div className="text-xs text-muted-foreground mb-1">Día menos activo</div>
                <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                  {analysis.diaMenosActivo.dia}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatCurrency(analysis.diaMenosActivo.total)} • {analysis.diaMenosActivo.cantidad} ventas
                </div>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <div className="text-xs text-muted-foreground mb-1">Período efectivo</div>
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {analysis.primeraHoraActiva} - {analysis.ultimaHoraActiva}
                </div>
                <div className="text-sm text-muted-foreground">
                  horas con actividad significativa
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm font-medium mb-2">Ranking por día</div>
              <div className="space-y-2">
                {analysis.diasAnalysis.map((dia, index) => (
                  <div key={dia.dia} className="flex items-center gap-3">
                    <div className="w-8 text-center text-sm font-medium text-muted-foreground">
                      {index + 1}
                    </div>
                    <div className="w-24 text-sm">{dia.dia}</div>
                    <div className="flex-1">
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{
                            width: `${analysis.diaMasActivo.total > 0 ? (dia.total / analysis.diaMasActivo.total) * 100 : 0}%`
                          }}
                        />
                      </div>
                    </div>
                    <div className="w-24 text-right text-sm font-medium">
                      {formatCurrency(dia.total)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recomendaciones */}
      {analysis.recomendaciones.length > 0 && (
        <div className="rounded-2xl border border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/10">
          <div className="p-4 pb-2">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <h3 className="text-sm font-medium">Recomendaciones</h3>
            </div>
          </div>
          <div className="px-4 pb-4">
            <div className="space-y-3">
              {analysis.recomendaciones.map((rec, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-100 dark:bg-yellow-800 flex items-center justify-center text-xs font-medium text-yellow-700 dark:text-yellow-200">
                    {index + 1}
                  </div>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
