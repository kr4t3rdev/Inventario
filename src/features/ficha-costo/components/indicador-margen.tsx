'use client'

import { cn } from '@/lib/utils'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { EstadoMargen } from '../actions'

interface IndicadorMargenProps {
  porcentaje: number | null
  estado: EstadoMargen
  className?: string
}

/**
 * @description Badge de margen con texto e icono (no solo color) para
 *   satisfacer el requisito de accesibilidad NFR-003.
 */
export function IndicadorMargen({
  porcentaje,
  estado,
  className,
}: IndicadorMargenProps) {
  const config = getConfig(estado, porcentaje)
  const Icon = config.icon
  return (
    <span
      role="status"
      aria-label={config.aria}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm font-medium',
        config.classes,
        className,
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  )
}

function getConfig(estado: EstadoMargen, porcentaje: number | null) {
  if (estado === 'SIN_DATOS') {
    return {
      classes: 'border-muted-foreground/30 bg-muted text-muted-foreground',
      icon: Minus,
      label: 'Margen sin datos',
      aria: 'Margen no disponible por falta de datos confiables',
    }
  }
  if (estado === 'SIN_PRECIO') {
    return {
      classes: 'border-muted-foreground/30 bg-muted text-muted-foreground',
      icon: Minus,
      label: 'Sin precio de venta',
      aria: 'Margen no disponible: producto sin precio de venta',
    }
  }
  if (estado === 'PERDIDA') {
    return {
      classes: 'border-red-500/40 bg-red-50 text-red-700',
      icon: ArrowDownRight,
      label: porcentaje === null ? 'Pérdida' : `Pérdida ${porcentaje.toFixed(1)}%`,
      aria: `Margen negativo: ${porcentaje?.toFixed(1)}%`,
    }
  }
  if (estado === 'BAJO') {
    return {
      classes: 'border-amber-500/40 bg-amber-50 text-amber-700',
      icon: ArrowUpRight,
      label: porcentaje === null ? 'Margen bajo' : `Margen bajo ${porcentaje.toFixed(1)}%`,
      aria: `Margen bajo: ${porcentaje?.toFixed(1)}%`,
    }
  }
  return {
    classes: 'border-emerald-500/40 bg-emerald-50 text-emerald-700',
    icon: ArrowUpRight,
    label: porcentaje === null ? 'Margen saludable' : `Margen ${porcentaje.toFixed(1)}%`,
    aria: `Margen saludable: ${porcentaje?.toFixed(1)}%`,
  }
}
