
"use client"

import { Star, TrendingUp, TrendingDown } from "lucide-react"

interface ChannelItem {
  posicion: number
  canal: string
  total: number
  cantidad: number
  porcentaje: number
  tendencia: number
  color: string
}

interface TopChannelsListProps {
  data: ChannelItem[]
}

export function TopChannelsList({ data }: TopChannelsListProps) {
  const totalCanales = data.length
  const totalFacturado = data.reduce((sum, item) => sum + item.total, 0)

  return (
    <div className="flex flex-col h-full w-full bg-card text-card-foreground p-4 rounded-lg border shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-1">
             TOP {Math.min(4, data.length)} <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
          </h3>
          <div className="text-xs font-bold">Total Facturado</div>
          <p className="text-[10px] text-muted-foreground">Canal de pago electrónico</p>
        </div>
      </div>

      <div className="flex-1 space-y-3">
        {data.slice(0, 4).map((item) => (
          <div key={item.posicion} className="flex items-center gap-3">
            <div 
              className="flex-shrink-0 w-8 h-8 rounded-full border flex items-center justify-center font-bold text-muted-foreground text-sm shadow-sm bg-muted/20"
              style={{ borderColor: item.color }}
            >
              {item.posicion}°
            </div>
            <div className="flex-1 text-center">
              <div className="text-xs font-bold">{item.canal}</div>
              <div className="text-sm font-bold">${item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
                <span>{item.porcentaje}%</span>
                <span className={`flex items-center ${item.tendencia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {item.tendencia >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(item.tendencia).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-2 border-t space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground">Total Canal electrónicos:</span>
          <span className="font-bold">{totalCanales}</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground">Facturación total:</span>
          <span className="font-bold">${totalFacturado.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}
