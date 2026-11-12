
"use client"

import { useState } from "react"
import { Activity } from "lucide-react"
import { formatCurrency } from "@/components/sugerencias/wanda/chart-theme"

interface HeatmapHour {
  hora: string
  total: number
  cantidad: number
}

interface HeatmapDay {
  dia: string
  horas: HeatmapHour[]
}

interface HourlySalesHeatmapProps {
  data: HeatmapDay[]
}

/**
 * @description Heatmap semanal mostrando las ventas cruzadas por dia de la semana y hora del dia.
 * Cada celda usa un gradiente de color segun el volumen de ventas.
 * @param {HourlySalesHeatmapProps} props - Props del componente.
 * @returns {JSX.Element} Heatmap 7x24 con tooltip al hover.
 */
export function HourlySalesHeatmap({ data }: HourlySalesHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{ dia: number; hora: number } | null>(null)

  // Find max value for color scaling
  const maxTotal = Math.max(
    ...data.flatMap((d) => d.horas.map((h) => h.total)),
    1,
  )

  const diaLabels = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"]

  /**
   * @description Calcula el color de la celda segun la intensidad del valor.
   * @param {number} value - Valor de la celda.
   * @returns {string} Color en formato HSL.
   */
  const cellColor = (value: number): string => {
    if (value === 0) return "hsl(var(--muted))"
    const intensity = Math.min(value / maxTotal, 1)
    // Gradient from light blue to deep blue/red
    const hue = 220 - intensity * 180 // 220 (blue) → 40 (amber/red)
    const saturation = 60 + intensity * 40
    const lightness = 85 - intensity * 55
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
  }

  return (
    <div className="flex flex-col h-full w-full bg-card text-card-foreground p-4 rounded-lg border shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-3 w-3 text-muted-foreground" />
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>Bajo</span>
          <div className="flex gap-0.5">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
              <div
                key={v}
                className="w-3 h-2 rounded-sm"
                style={{ backgroundColor: cellColor(v * maxTotal) }}
              />
            ))}
          </div>
          <span>Alto</span>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        <div className="min-w-[1000px]">
          {/* Hour headers */}
          <div className="flex mb-1">
            <div className="w-12 flex-shrink-0" />
            <div className="flex-1 grid grid-cols-24 gap-px">
              {Array.from({ length: 24 }, (_, h) => (
                <div
                  key={h}
                  className="text-[8px] text-muted-foreground text-center truncate"
                >
                  {h % 3 === 0 ? `${h.toString().padStart(2, "0")}` : ""}
                </div>
              ))}
            </div>
          </div>

          {/* Day rows */}
          <div className="space-y-px">
            {data.map((diaRow, diaIndex) => (
              <div key={diaRow.dia} className="flex items-center">
                <div className="w-12 flex-shrink-0 text-[10px] font-medium text-muted-foreground">
                  {diaLabels[diaIndex]}
                </div>
                <div className="flex-1 grid grid-cols-24 gap-px">
                  {diaRow.horas.map((hora, horaIndex) => {
                    const isHovered =
                      hoveredCell?.dia === diaIndex && hoveredCell?.hora === horaIndex
                    return (
                      <div
                        key={hora.hora}
                        className={`aspect-square rounded-sm cursor-pointer transition-all duration-150 ${
                          isHovered ? "ring-2 ring-foreground ring-offset-1 scale-125 z-10" : ""
                        }`}
                        style={{
                          backgroundColor: cellColor(hora.total),
                        }}
                        onMouseEnter={() =>
                          setHoveredCell({ dia: diaIndex, hora: horaIndex })
                        }
                        onMouseLeave={() => setHoveredCell(null)}
                        title={`${diaRow.dia} ${hora.hora}: ${formatCurrency(hora.total)} (${hora.cantidad} ventas)`}
                        role="gridcell"
                        aria-label={`${diaRow.dia} ${hora.hora}: ${formatCurrency(hora.total)}, ${hora.cantidad} transacciones`}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip overlay */}
      {hoveredCell && (
        <div className="mt-2 text-xs text-center animate-fade-in">
          <span className="font-medium text-foreground">
            {data[hoveredCell.dia]?.dia} {data[hoveredCell.dia]?.horas[hoveredCell.hora]?.hora}:
          </span>{" "}
          <span className="text-muted-foreground">
            {formatCurrency(data[hoveredCell.dia]?.horas[hoveredCell.hora]?.total || 0)} ·{" "}
            {data[hoveredCell.dia]?.horas[hoveredCell.hora]?.cantidad || 0} transacciones
          </span>
        </div>
      )}
    </div>
  )
}
