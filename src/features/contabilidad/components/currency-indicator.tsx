"use client"

import { usePathname } from "next/navigation"
import { DollarSign, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { ResultadoMonedaPrincipal } from "@/lib/services/moneda-principal-service"

interface Moneda {
  codigo: string
  simbolo?: string | null
  esPrincipal?: boolean
}

interface TasaCambio {
  monedaOrigenId: string
  tasa: number | string
  fechaVigencia: string | Date
}

interface CurrencyIndicatorProps {
  monedas?: Moneda[]
  tasas?: TasaCambio[]
  /**
   * Moneda principal resuelta desde la política contable del tenant
   * (fuente de verdad); la marca global esPrincipal del catálogo no la define.
   */
  monedaPrincipal?: ResultadoMonedaPrincipal | null
}

// En el header apilado hay una fila propia; en escritorio se prioriza el menú.
const CURRENCY_LAYOUT =
  'flex min-w-0 flex-wrap items-center gap-2 px-3 lg:hidden xl:flex'

/**
 * @description Indicador compacto de la moneda principal de la empresa y tasas
 * para el header. La moneda principal proviene exclusivamente de la política
 * contable del tenant; si está ausente o no se pudo consultar, no se presenta
 * ninguna moneda como configurada.
 * @param {CurrencyIndicatorProps} props - Datos precargados desde el servidor.
 * @returns {JSX.Element | null} Badge de moneda con tasas visibles o null fuera de contabilidad.
 */
export function CurrencyIndicator({
  monedas = [],
  tasas = [],
  monedaPrincipal = null,
}: CurrencyIndicatorProps) {
  const pathname = usePathname()

  // Only show on contabilidad pages
  if (!pathname.startsWith("/busy/contabilidad")) {
    return null
  }

  const codigoPrincipal =
    monedaPrincipal?.estado === "CONFIGURADA" && monedaPrincipal.moneda
      ? monedaPrincipal.moneda
      : null

  if (!codigoPrincipal) {
    const mensaje =
      monedaPrincipal?.estado === "ERROR"
        ? "Moneda no disponible"
        : "Sin moneda configurada"
    return (
      <div className={CURRENCY_LAYOUT}>
        <Badge variant="outline" className="flex items-center gap-1">
          <DollarSign className="h-3 w-3" />
          {mensaje}
        </Badge>
      </div>
    )
  }

  const tasasSecundarias = tasas.filter(t => t.monedaOrigenId !== codigoPrincipal)

  return (
    <TooltipProvider>
      <div className={CURRENCY_LAYOUT}>
        <Badge variant="default" className="flex items-center gap-1">
          <DollarSign className="h-3 w-3" />
          {codigoPrincipal}
        </Badge>

        {tasasSecundarias.length > 0 && (
          <div className="flex min-w-0 flex-wrap items-center gap-1 lg:hidden 2xl:flex">
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
                    <p>1 {moneda.codigo} = {Number(tasa.tasa).toFixed(2)} {codigoPrincipal}</p>
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
