'use client'

import { useMemo } from 'react'
import {
  DollarSign, Package, ShoppingCart, BarChart3,
  TrendingUp, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { cn, formatCurrency } from '@/lib/utils'

interface SectionCardsDashboardStats {
  totalIngresos: number
  totalBeneficio: number
  valorTotalInventario: number
  totalProductos: number
  ventasDiarias: {
    ventasHoy: number
    ingresosHoy: number
    ventasAyer: number
    ingresosAyer: number
    promedioVentasDiarias: number
    promedioIngresosDiarios: number
    diasConVentas: number
    totalDias: number
    totalIngresosPeriodo: number
    totalCantidadPeriodo: number
  }
}

interface SectionCardsProps {
  dashboardStats: SectionCardsDashboardStats
}

/**
 * @description Indicadores principales del dashboard con jerarquía visual por relevancia.
 * @param {SectionCardsProps} props - Estadísticas del dashboard recibidas por props
 * @returns {JSX.Element} Grid responsivo de cuatro indicadores
 */
export function SectionCards({ dashboardStats }: SectionCardsProps): React.JSX.Element {
  const cards = useMemo(() => {
    const { totalIngresos, totalBeneficio, valorTotalInventario, totalProductos, ventasDiarias } = dashboardStats
    const margen = totalIngresos > 0 ? (totalBeneficio / totalIngresos) * 100 : 0
    const cambioHoyVsAyer = ventasDiarias.ingresosAyer > 0
      ? ((ventasDiarias.ingresosHoy - ventasDiarias.ingresosAyer) / ventasDiarias.ingresosAyer) * 100 : 0
    const tasaActividad = ventasDiarias.totalDias > 0
      ? (ventasDiarias.diasConVentas / ventasDiarias.totalDias) * 100 : 0
    const sube = cambioHoyVsAyer >= 0
    const trendStyles = 'border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300'
    const declineStyles = 'border-rose-200 text-rose-700 dark:border-rose-800 dark:text-rose-300'

    return [
      {
        title: 'Total Ingresos',
        value: formatCurrency(totalIngresos),
        icon: DollarSign,
        layout: 'md:col-span-2 xl:col-span-2',
        valueStyle: 'text-3xl',
        iconStyle: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        badge: (
          <Badge variant="outline" className="gap-1 border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
            <TrendingUp className="h-3 w-3" />{margen.toFixed(1)}% margen
          </Badge>
        ),
        description: 'Ingresos totales del período',
      },
      {
        title: 'Valor Inventario',
        value: formatCurrency(valorTotalInventario),
        icon: Package,
        layout: 'xl:col-span-1',
        valueStyle: 'text-2xl',
        iconStyle: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
        badge: <Badge variant="secondary" className="text-xs">{totalProductos} productos</Badge>,
        description: 'Valor total del inventario en stock',
      },
      {
        title: 'Ventas de Hoy',
        value: formatCurrency(ventasDiarias.ingresosHoy),
        icon: ShoppingCart,
        layout: 'xl:col-span-1',
        valueStyle: 'text-2xl',
        iconStyle: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
        badge: (
          <Badge variant="outline" className={cn('gap-1', sube ? trendStyles : declineStyles)}>
            {sube ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {sube ? '+' : ''}{cambioHoyVsAyer.toFixed(1)}% vs ayer
          </Badge>
        ),
        description: 'Ventas realizadas hoy',
      },
      {
        title: 'Promedio Diario',
        value: formatCurrency(ventasDiarias.promedioIngresosDiarios),
        icon: BarChart3,
        layout: 'xl:col-span-1',
        valueStyle: 'text-2xl',
        iconStyle: 'bg-primary/10 text-primary',
        badge: <Badge variant="secondary" className="text-xs">{tasaActividad.toFixed(0)}% actividad</Badge>,
        description: 'Promedio de ingresos diarios (30 días)',
      },
    ]
  }, [dashboardStats])

  return (
    <section
      aria-label="Indicadores principales"
      className="grid min-w-0 grid-cols-1 gap-4 px-4 md:grid-cols-2 lg:px-6 xl:grid-cols-5"
    >
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.title}
            className={cn('min-w-0', card.layout)}
          >
            <Card className="h-full min-w-0 border-border/70 bg-card shadow-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                <div className={cn('rounded-lg p-2', card.iconStyle)}>
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </div>
              </CardHeader>
              <div className="px-5 pb-2">
                <div className={cn('font-semibold tracking-tight tabular-nums', card.valueStyle)}>{card.value}</div>
                <div className="mt-1">{card.badge}</div>
              </div>
              <CardFooter>
                <CardDescription>{card.description}</CardDescription>
              </CardFooter>
            </Card>
          </div>
        )
      })}
    </section>
  )
}
