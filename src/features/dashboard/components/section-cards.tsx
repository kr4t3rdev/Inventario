'use client'

import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
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
 * @description Tarjetas de métricas principales del dashboard con animaciones de entrada.
 * @param {SectionCardsProps} props - Estadísticas del dashboard recibidas por props
 * @returns {JSX.Element} Grid de 4 tarjetas animadas
 */
export function SectionCards({ dashboardStats }: SectionCardsProps): React.JSX.Element {
  const shouldReduceMotion = useReducedMotion()

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
        gradient: 'from-emerald-500 to-teal-600',
        iconBg: 'bg-emerald-500/20',
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
        gradient: 'from-blue-500 to-indigo-600',
        iconBg: 'bg-blue-500/20',
        badge: <Badge variant="secondary" className="text-xs">{totalProductos} productos</Badge>,
        description: 'Valor total del inventario en stock',
      },
      {
        title: 'Ventas de Hoy',
        value: formatCurrency(ventasDiarias.ingresosHoy),
        icon: ShoppingCart,
        gradient: 'from-amber-500 to-orange-600',
        iconBg: 'bg-amber-500/20',
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
        gradient: 'from-violet-500 to-purple-600',
        iconBg: 'bg-violet-500/20',
        badge: <Badge variant="secondary" className="text-xs">{tasaActividad.toFixed(0)}% actividad</Badge>,
        description: 'Promedio de ingresos diarios (30 días)',
      },
    ]
  }, [dashboardStats])

  const containerVariants = shouldReduceMotion ? {} : {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
  }

  const itemVariants = shouldReduceMotion ? {} : {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 60, damping: 15 } },
  }

  if (shouldReduceMotion) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.title}>
              <Card className="group relative overflow-hidden border-0 bg-card/50 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-md">
                <div className={cn('absolute -top-10 -right-10 h-32 w-32 rounded-full blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100', card.iconBg)} />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                  <div className={cn('rounded-xl bg-linear-to-br p-2.5 shadow-lg', card.gradient)}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                </CardHeader>
                <div className="px-5 pb-2">
                  <div className="text-2xl font-bold tracking-tight">{card.value}</div>
                  <div className="mt-1">{card.badge}</div>
                </div>
                <CardFooter>
                  <CardDescription>{card.description}</CardDescription>
                </CardFooter>
              </Card>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <motion.div
      className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
  // @ts-expect-error
      variants={
      containerVariants
      }
      initial="hidden"
      animate="show"
    >
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <motion.div key={
  // @ts-expect-error
          card.title} variants={itemVariants} whileHover={{ y: -4, transition: { duration: 0.2 } }
          }>
            <Card className="group relative overflow-hidden border-0 bg-card/50 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-md">
              <div className={cn('absolute -top-10 -right-10 h-32 w-32 rounded-full blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100', card.iconBg)} />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                <div className={cn('rounded-xl bg-linear-to-br p-2.5 shadow-lg', card.gradient)}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <div className="px-5 pb-2">
                <div className="text-2xl font-bold tracking-tight">{card.value}</div>
                <div className="mt-1">{card.badge}</div>
              </div>
              <CardFooter>
                <CardDescription>{card.description}</CardDescription>
              </CardFooter>
            </Card>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
