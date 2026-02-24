
"use client"

import { Check, ShoppingCart } from "lucide-react"

interface SummaryCardProps {
  totalFacturado: number
  totalVentas: number
  totalServicios: number
  cantidadTransacciones: number
  ticketPromedio: number
  variacionPorcentual: number
}

export function SummaryCard({
  totalFacturado,
  totalVentas,
  totalServicios,
  cantidadTransacciones,
  ticketPromedio,
  variacionPorcentual
}: SummaryCardProps) {
  const isPositive = variacionPorcentual >= 0

  return (
    <div className="flex flex-col h-full w-full bg-card text-card-foreground p-4 rounded-lg border shadow-sm justify-between">
      <h3 className="text-sm font-semibold mb-2">Total Ventas</h3>
      
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-full mt-1">
            <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground">${totalFacturado.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Total Facturación Anual</div>
            <div className={`text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? '+' : ''}{variacionPorcentual.toFixed(1)}% vs año anterior
            </div>
          </div>
        </div>

        <div className="border-t border-border my-2"></div>

        <div className="flex items-start gap-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-full mt-1">
            <ShoppingCart className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-foreground">{cantidadTransacciones.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">Ventas</span>
            </div>
            <div className="text-xs text-muted-foreground">Ventas Atendidas Al Año</div>
            <div className="text-xs text-muted-foreground mt-1">
              Ticket promedio: ${ticketPromedio.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
