'use client'

import { useEffect, useState } from 'react'
import { LazyMotion, m as motion, useReducedMotion } from 'framer-motion'
import { Users, UserCheck, Shield, Clock, TrendingUp, TrendingDown } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TenantUsersStatsProps {
  total: number
  active: number
  admins: number
  pending: number
  prevPending?: number
}

/**
 * @description Contador animado que incrementa desde 0 hasta el valor final.
 */
function AnimatedCounter({ value, duration = 1.5 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    if (shouldReduceMotion) {
      setCount(value)
      return
    }
    let start = 0
    const end = value
    if (end === 0) {
      setCount(0)
      return
    }
    const increment = end / (duration * 60)
    const timer = setInterval(() => {
      start += increment
      if (start >= end) {
        setCount(end)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, 16)
    return () => clearInterval(timer)
  }, [value, duration, shouldReduceMotion])

  return <span>{count}</span>
}

interface StatConfig {
  title: string
  value: number
  icon: React.ElementType
  gradient: string
  bgGlow: string
  trend: { icon: React.ElementType; color: string; text: string } | string | null
}

/**
 * @description Tarjetas de estadísticas animadas para el panel de usuarios del tenant.
 * @param {TenantUsersStatsProps} props - Datos de estadísticas
 * @returns {JSX.Element} Grid de 4 tarjetas con contadores animados y gradientes
 */
export function TenantUsersStats({ total, active, admins, pending, prevPending }: TenantUsersStatsProps) {
  const shouldReduceMotion = useReducedMotion()

  const stats: StatConfig[] = [
    {
      title: 'Total Usuarios',
      value: total,
      icon: Users,
      gradient: 'from-primary to-purple',
      bgGlow: 'bg-blue-500/20',
      trend: total > 0 ? `${Math.round((active / total) * 100)}% activos` : null,
    },
    {
      title: 'Usuarios Activos',
      value: active,
      icon: UserCheck,
      gradient: 'from-emerald-500 to-teal-600',
      bgGlow: 'bg-emerald-500/20',
      trend: null,
    },
    {
      title: 'Administradores',
      value: admins,
      icon: Shield,
      gradient: 'from-primary to-purple',
      bgGlow: 'bg-purple/20',
      trend: null,
    },
    {
      title: 'Solicitudes Pendientes',
      value: pending,
      icon: Clock,
      gradient: 'from-amber-500 to-orange-600',
      bgGlow: 'bg-amber-500/20',
      trend:
        prevPending !== undefined && pending > prevPending
          ? { icon: TrendingUp, color: 'text-red-500', text: `+${pending - prevPending}` }
          : prevPending !== undefined && pending < prevPending
            ? { icon: TrendingDown, color: 'text-emerald-500', text: `${pending - prevPending}` }
            : null,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon
        return (
          <motion.div
            key={stat.title}
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.4 }}
          >
            <Card className="relative overflow-hidden border-0 bg-slate-900/5 dark:bg-white/5 backdrop-blur-sm hover:shadow-lg hover:shadow-purple/10 transition-all duration-300 group cursor-pointer">
              {/* Background glow on hover */}
              <div
                className={`absolute -top-10 -right-10 h-32 w-32 rounded-full ${stat.bgGlow} blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
              />

              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <div className={`rounded-xl bg-linear-to-br ${stat.gradient} p-2.5 shadow-lg`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-3">
                  <div className="text-3xl font-bold tracking-tight">
                    <AnimatedCounter value={stat.value} />
                  </div>
                  {stat.trend && (
                    <div className="mb-1.5 flex items-center gap-1">
                      {typeof stat.trend === 'string' ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {stat.trend}
                        </span>
                      ) : (
                        <>
                          <stat.trend.icon className={`h-3 w-3 ${stat.trend.color}`} />
                          <span className={`text-xs font-medium ${stat.trend.color}`}>{stat.trend.text}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}
