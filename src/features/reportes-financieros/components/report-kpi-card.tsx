"use client"

import type { LucideIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { SURFACE_CARD_CLASS } from "@/features/reportes-financieros/lib/reporte-styles"

interface ReportKpiCardProps {
  /** Etiqueta corta del indicador. */
  label: string
  /** Valor principal ya formateado (moneda, número, porcentaje). */
  value: React.ReactNode
  /** Icono opcional a la derecha del encabezado. */
  icon?: LucideIcon
  /** Texto de apoyo debajo del valor. */
  sublabel?: string
  /** Clases extra para el valor (p. ej. color semántico). */
  valueClassName?: string
}

/**
 * @description Tarjeta KPI unificada para el módulo de reportes.
 *   Unifica el patrón de etiqueta + icono + valor + subtexto que antes
 *   variaba entre sub-reportes.
 * @param {ReportKpiCardProps} props - Contenido del indicador.
 * @returns {JSX.Element} Tarjeta de indicador.
 */
export function ReportKpiCard({
  label,
  value,
  icon: Icon,
  sublabel,
  valueClassName,
}: ReportKpiCardProps) {
  return (
    <Card className={SURFACE_CARD_CLASS}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription className="text-sm font-medium">{label}</CardDescription>
        {Icon ? (
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        ) : null}
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", valueClassName)}>{value}</div>
        {sublabel ? (
          <p className="text-xs text-muted-foreground">{sublabel}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
