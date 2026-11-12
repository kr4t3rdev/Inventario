"use client"

import { useEffect, useState } from "react"
import { HourlySalesBarChart } from "@/components/sugerencias/wanda/hourly-sales-bar-chart"
import { HourlySalesHeatmap } from "@/components/sugerencias/wanda/hourly-sales-heatmap"
import { HorarioVentasAnalysis } from "@/features/reportes-financieros/components/horario-ventas/horario-ventas-analysis"
import { Button } from "@/components/ui/button"
import { BarChart3, Grid3x3 } from "lucide-react"

interface HourlyData {
  hora: string
  total: number
  cantidad: number
}

interface HeatmapDay {
  dia: string
  horas: HourlyData[]
}

interface DashboardResponse {
  hourlySalesBarChart?: { titulo: string; data: HourlyData[] }
  hourlySalesHeatmap?: { titulo: string; data: HeatmapDay[] }
}

/**
 * @description Componente principal para el reporte de horario efectivo de ventas.
 * Carga los datos del dashboard Wanda y muestra ambos gráficos (barras y heatmap)
 * apilados para una vista completa del horario de ventas.
 * @returns {JSX.Element} Vista del reporte con gráficos de horario de ventas.
 */
export function ReporteHorarioVentas() {
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/dashboard/wanda")
      .then((res) => {
        if (!res.ok) throw new Error("Error al cargar los datos")
        return res.json()
      })
      .then((json) => {
        setData(json)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Cargando datos de ventas...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="text-red-600 dark:text-red-400">{error}</div>
        <Button onClick={() => window.location.reload()}>Reintentar</Button>
      </div>
    )
  }

  const barData = data?.hourlySalesBarChart?.data ?? []
  const heatmapData = data?.hourlySalesHeatmap?.data ?? []

  return (
    <div className="space-y-6">
      {/* Bar Chart - Ventas por hora */}
      <div className="rounded-2xl border border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/10">
        <div className="p-4 pb-2">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Ventas por Hora del Día</h3>
            <p className="text-xs text-muted-foreground ml-auto">
              Distribución de 24 horas
            </p>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="h-[350px] w-full">
            <HourlySalesBarChart data={barData} />
          </div>
        </div>
      </div>

      {/* Heatmap - Patrones semanales */}
      <div className="rounded-2xl border border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/10">
        <div className="p-4 pb-2">
          <div className="flex items-center gap-2 mb-2">
            <Grid3x3 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Patrones Semanales</h3>
            <p className="text-xs text-muted-foreground ml-auto">
              Día × Hora
            </p>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="w-full overflow-x-auto">
            <HourlySalesHeatmap data={heatmapData} />
          </div>
        </div>
      </div>

      {/* Análisis detallado */}
      <HorarioVentasAnalysis barData={barData} heatmapData={heatmapData} />
    </div>
  )
}
