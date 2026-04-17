"use client"

import React from "react"
import { TrendingUpIcon, Package, BarChart3, ArrowUpRight, ArrowDownRight, DollarSign, ShoppingCart } from "lucide-react"
import { useGetDashboardStatsQuery } from "@/lib/redux/services/dashboardApi"

import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { motion } from "framer-motion"

/**
 * Componente SectionCards que muestra las tarjetas estadísticas principales del dashboard
 * Muestra información sobre ingresos totales, valor del inventario, ventas del día y promedios
 * 
 * @returns {JSX.Element} Grid de tarjetas de estadísticas con animaciones
 */
export function SectionCards() {
  const { data: stats, isLoading } = useGetDashboardStatsQuery()

  // Datos simplificados usando los valores calculados en el backend
  const ventasDiarias = stats?.ventasDiarias || {
    ventasHoy: 0,
    ingresosHoy: 0,
    ventasAyer: 0,
    ingresosAyer: 0,
    promedioVentasDiarias: 0,
    promedioIngresosDiarios: 0,
    diasConVentas: 0,
    totalDias: 0,
    totalIngresosPeriodo: 0,
    totalCantidadPeriodo: 0
  }

  // Margen bruto
  const margenBruto = 0

  if (isLoading) {
    return (
      <motion.div 
        className="grid grid-cols-1 gap-4 px-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 lg:px-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {[1, 2, 3, 4].map((i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
          >
            <Card className="@container/card overflow-hidden">
              <CardHeader className="relative">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-8 w-32 mt-2" />
                <div className="absolute right-4 top-4">
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              </CardHeader>
              <CardFooter className="flex-col items-start gap-1 text-sm">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </CardFooter>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    )
  }

  // Calcular variación porcentual
  const variacionPorcentual = ventasDiarias.ingresosAyer > 0 
    ? ((ventasDiarias.ingresosHoy - ventasDiarias.ingresosAyer) / ventasDiarias.ingresosAyer) * 100 
    : 0
  const esPositivo = variacionPorcentual >= 0

  const cards = [
    {
      id: 'ingresos',
      icon: DollarSign,
      title: 'Total Ingresos',
      value: `$${stats?.totalIngresos?.toLocaleString() || 0}`,
      badge: `${margenBruto.toFixed(2)}%`,
      badgeIcon: TrendingUpIcon,
      footer: 'Ingresos de los últimos 6 meses',
      footerIcon: ArrowUpRight,
      color: 'emerald',
      href: null
    },
    {
      id: 'inventario',
      icon: Package,
      title: 'Valor Inventario',
      value: `$${stats?.valorTotalInventario?.toLocaleString() || 0}`,
      badge: `${stats?.totalProductos || 0} productos`,
      badgeIcon: Package,
      footer: 'Valor total del inventario actual',
      footerIcon: Package,
      color: 'blue',
      href: null
    },
    {
      id: 'ventas-hoy',
      icon: ShoppingCart,
      title: 'Ventas de Hoy',
      value: `$${ventasDiarias.ingresosHoy.toLocaleString()}`,
      badge: `${ventasDiarias.ventasHoy} ventas`,
      badgeIcon: esPositivo ? ArrowUpRight : ArrowDownRight,
      footer: `Ayer: $${ventasDiarias.ingresosAyer.toLocaleString()} (${ventasDiarias.ventasAyer} ventas)`,
      footerIcon: null,
      color: 'green',
      href: '/busy/cuadre',
      showVariation: true
    },
    {
      id: 'promedio',
      icon: BarChart3,
      title: 'Promedio Diario',
      value: `$${ventasDiarias.promedioIngresosDiarios.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      badge: `${ventasDiarias.diasConVentas}/${ventasDiarias.totalDias} días`,
      badgeIcon: BarChart3,
      footer: `Promedio de los últimos ${ventasDiarias.totalDias} días`,
      footerIcon: null,
      color: 'indigo',
      href: null
    }
  ]

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; darkBg: string; text: string; lightBg: string }> = {
      emerald: { bg: 'bg-emerald-100', darkBg: 'dark:bg-emerald-900/30', text: 'text-emerald-600', lightBg: 'bg-emerald-50 dark:bg-emerald-900/20' },
      blue: { bg: 'bg-blue-100', darkBg: 'dark:bg-blue-900/30', text: 'text-blue-600', lightBg: 'bg-blue-50 dark:bg-blue-900/20' },
      green: { bg: 'bg-green-100', darkBg: 'dark:bg-green-900/30', text: 'text-green-600', lightBg: 'bg-green-50 dark:bg-green-900/20' },
      indigo: { bg: 'bg-indigo-100', darkBg: 'dark:bg-indigo-900/30', text: 'text-indigo-600', lightBg: 'bg-indigo-50 dark:bg-indigo-900/20' }
    }
    return colors[color] || colors.emerald
  }

  return (
    <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:from-primary/10 dark:*:data-[slot=card]:to-card lg:px-6">
      {cards.map((card, index) => {
        const colors = getColorClasses(card.color)

        const cardContent = (
          <Card className="@container/card group cursor-pointer overflow-hidden relative hover:shadow-lg transition-shadow">
            <CardHeader className="relative">
              <CardDescription className="flex items-center gap-2">
                <motion.div
                  className={`p-1.5 rounded-lg ${colors.bg} ${colors.darkBg}`}
                  whileHover={{ 
                    scale: 1.1, 
                    rotate: 5,
                    transition: { type: 'spring', stiffness: 400, damping: 10 }
                  }}
                >
                  <card.icon className={`h-4 w-4 ${colors.text}`} />
                </motion.div>
                {card.title}
              </CardDescription>
              <CardTitle className={`@[250px]/card:text-3xl text-2xl font-semibold tabular-nums ${colors.text}`}>
                {card.value}
              </CardTitle>
              <motion.div 
                className="absolute right-4 top-4"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 15,
                  delay: 0.2 + index * 0.1
                }}
              >
                <Badge variant="outline" className={`flex gap-1 rounded-lg text-xs ${colors.text} ${colors.lightBg}`}>
                  <card.badgeIcon className="size-3" />
                  {card.badge}
                </Badge>
              </motion.div>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-sm">
              <div className="text-muted-foreground flex items-center gap-1">
                {card.footerIcon && (
                  <motion.div
                    animate={card.id === 'ingresos' ? { x: [0, 3, 0] } : { rotate: [0, 10, -10, 0] }}
                    transition={{ 
                      duration: card.id === 'ingresos' ? 1.5 : 2, 
                      repeat: Infinity, 
                      ease: 'easeInOut',
                      delay: card.id === 'ingresos' ? 0 : 0.5
                    }}
                  >
                    <card.footerIcon className={`h-3 w-3 ${colors.text}`} />
                  </motion.div>
                )}
                {card.footer}
              </div>
              
              {/* Variación para ventas de hoy */}
              {card.showVariation && ventasDiarias.ingresosAyer > 0 && (
                <motion.div 
                  className={`text-xs font-medium flex items-center gap-1 ${
                    esPositivo ? 'text-green-600' : 'text-red-600'
                  }`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                >
                  <motion.span
                    animate={{ y: esPositivo ? [0, -2, 0] : [0, 2, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    {esPositivo ? '↗' : '↘'}
                  </motion.span>
                  {Math.abs(variacionPorcentual).toFixed(1)}% vs ayer
                </motion.div>
              )}
              
              {card.showVariation && ventasDiarias.promedioIngresosDiarios > 0 && (
                <motion.div 
                  className={`text-xs font-medium flex items-center gap-1 ${
                    ventasDiarias.ingresosHoy > ventasDiarias.promedioIngresosDiarios
                      ? 'text-blue-600'
                      : ventasDiarias.ingresosHoy < ventasDiarias.promedioIngresosDiarios
                      ? 'text-orange-600'
                      : 'text-gray-600'
                  }`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                >
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  >
                    <BarChart3 className="h-3 w-3" />
                  </motion.span>
                  vs Promedio: {ventasDiarias.ingresosHoy > ventasDiarias.promedioIngresosDiarios ? '+' :
                   ventasDiarias.ingresosHoy < ventasDiarias.promedioIngresosDiarios ? '-' : '='}
                  {Math.abs(((ventasDiarias.ingresosHoy - ventasDiarias.promedioIngresosDiarios) / ventasDiarias.promedioIngresosDiarios) * 100).toFixed(1)}%
                </motion.div>
              )}

              {card.id === 'promedio' && (
                <motion.div 
                  className="text-xs text-muted-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                >
                  Total: ${(ventasDiarias.totalIngresosPeriodo ?? 0).toLocaleString()} ({(ventasDiarias.totalCantidadPeriodo ?? 0)} productos)
                </motion.div>
              )}
            </CardFooter>
            {/* Efecto de brillo en hover */}
            <motion.div
              className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
              initial={false}
            />
          </Card>
        )

        return (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: 0.5,
              delay: index * 0.1,
              type: 'spring',
              stiffness: 100,
              damping: 15
            }}
            whileHover={{ 
              y: -5, 
              transition: { duration: 0.2 } 
            }}
          >
            {card.href ? (
              <Link href={card.href} className="block">
                {cardContent}
              </Link>
            ) : (
              cardContent
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
