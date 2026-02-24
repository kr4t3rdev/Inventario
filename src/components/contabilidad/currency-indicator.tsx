"use client"

import { usePathname } from "next/navigation"
import { DollarSign, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useGetMonedasQuery, useGetTasasActualesQuery } from "@/lib/redux/services/contabilidadApi"

export function CurrencyIndicator() {
  const pathname = usePathname()
  const { data: monedasData } = useGetMonedasQuery()
  const { data: tasasData } = useGetTasasActualesQuery()

  // Only show on contabilidad pages
  if (!pathname.startsWith("/busy/contabilidad")) {
    return null
  }

  // Ensure we have arrays to work with
  const monedas = Array.isArray(monedasData) ? monedasData : []
  const tasas = Array.isArray(tasasData) ? tasasData : []

  const monedaPrincipal = monedas.find(m => m.esPrincipal)
  const tasasSecundarias = tasas.filter(t => t.monedaOrigenId !== monedaPrincipal?.codigo)

  if (!monedaPrincipal) {
    return (
      <div className="flex items-center gap-2 px-3">
        <Badge variant="outline" className="flex items-center gap-1">
          <DollarSign className="h-3 w-3" />
          CUP
        </Badge>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 px-3">
        <Badge variant="default" className="flex items-center gap-1">
          <DollarSign className="h-3 w-3" />
          {monedaPrincipal.codigo}
        </Badge>

        {tasasSecundarias && tasasSecundarias.length > 0 && (
          <div className="flex items-center gap-1">
            {tasasSecundarias.slice(0, 2).map((tasa) => {
              const moneda = monedas.find(m => m.codigo === tasa.monedaOrigenId)
              if (!moneda) return null

              return (
                <Tooltip key={tasa.monedaOrigenId}>
                  <TooltipTrigger>
                    <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                      {moneda.simbolo}
                      <span className="text-xs">{Number(tasa.tasa).toFixed(2)}</span>
                      {/* Simple trend indicator - you could enhance this with historical data */}
                      <TrendingUp className="h-2 w-2 text-green-500" />
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>1 {moneda.codigo} = {Number(tasa.tasa).toFixed(2)} {monedaPrincipal.codigo}</p>
                    <p className="text-xs text-muted-foreground">
                      Actualizado: {new Date(tasa.fechaVigencia).toLocaleDateString()}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )
            })}

            {tasasSecundarias.length > 2 && (
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-xs">
                    +{tasasSecundarias.length - 2}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{tasasSecundarias.length - 2} monedas más disponibles</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}