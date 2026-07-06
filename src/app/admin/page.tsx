'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import {
  Building2,
  Users,
  Activity,
  Wallet,
  AlertTriangle,
  Shield,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  UserCheck,
  Globe,
  Loader2,
} from "lucide-react"
import { LazyMotion, m as motion, type Variants } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageTransition, StaggerContainer, StaggerItem, AnimatedCard } from "@/components/ui/animations"
import { getAdminTenantsAction, getAdminFinanceAction, getAdminSystemHealthAction } from "@/features/admin"

interface SystemAlert {
  id: string
  severity: "critical" | "warning" | "info"
  message: string
  time: string
}

const headerIconVariants: Variants = {
  initial: { scale: 1, rotate: 0 },
  hover: {
    scale: 1.05, rotate: 5,
    transition: { type: "spring" as const, stiffness: 400, damping: 10 },
  },
}

const titleVariants: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1, y: 0,
    transition: { type: "spring" as const, stiffness: 100, damping: 15 },
  },
}

const severityConfig = {
  critical: { bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400", dot: "bg-rose-500" },
  warning: { bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  info: { bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
}

/**
 * @description Admin control panel dashboard with real global system data.
 * @returns {JSX.Element} Admin overview page with system-wide metrics.
 */
export default function AdminDashboardPage(): React.JSX.Element {
  const [tenants, setTenants] = useState<any[]>([])
  const [finance, setFinance] = useState<any>(null)
  const [system, setSystem] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => { setIsLoading(true); Promise.all([getAdminTenantsAction(), getAdminFinanceAction(), getAdminSystemHealthAction()]).then(([r1,r2,r3]) => { if(r1.success) setTenants(r1.data??[]); if(r2.success) setFinance(r2.data); if(r3.success) setSystem(r3.data); setLastUpdated(new Date()); setIsLoading(false) }) }, [])
  const safeTenants = tenants ?? []
  const loading = isLoading
  const safeFinance = finance
  const safeSystem = system ?? { users: { total: 0, byRole: [] }, tenants: { total: 0 }, sessions: { active: 0 }, licenses: { total: 0, active: 0, expiringSoon: 0 }, usersTrend: [] }
  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(Math.round(change)),
      direction: change > 0 ? 'up' as const : change < 0 ? 'down' as const : 'neutral' as const,
    };
  };

  // Calcular tendencias de los últimos 7 días vs 7 días anteriores
  const revenueTrend = safeFinance?.revenueTrend ?? [];
  const usersTrend = safeSystem?.usersTrend ?? [];
  
  const currentWeekRevenue = revenueTrend.slice(-7).reduce(
    (sum: number, d: { ingresos: number }) => sum + d.ingresos,
    0,
  );
  const previousWeekRevenue = 0; // TODO: implementar datos de semana anterior
  const revenueTrendData = calculateTrend(currentWeekRevenue, previousWeekRevenue);

  const currentWeekUsers = usersTrend.slice(-7).reduce(
    (sum: number, d: { usuarios: number }) => sum + d.usuarios,
    0,
  );
  const previousWeekUsers = 0; // TODO: implementar datos de semana anterior
  const usersTrendData = calculateTrend(currentWeekUsers, previousWeekUsers);


  const kpiCards = [
    {
      title: "Total Tenants",
      value: safeSystem?.tenants.total ?? safeTenants.length,
      loading: isLoading,
      trend: null,
      description: "Empresas registradas en la plataforma",
      icon: Building2,
      valueClassName: "text-violet-600 dark:text-violet-400",
      iconBg: "from-violet-600/15 to-purple-600/15",
    },
    {
      title: "Usuarios del Sistema",
      value: safeSystem?.users.total ?? 0,
      loading: isLoading,
      trend: usersTrendData,
      description: "Usuarios registrados",
      icon: Users,
      valueClassName: "text-emerald-600 dark:text-emerald-400",
      iconBg: "from-emerald-600/15 to-teal-600/15",
    },
    {
      title: "Sesiones Activas",
      value: safeSystem?.sessions.active ?? 0,
      loading: isLoading,
      trend: null,
      description: "Usuarios con sesión abierta ahora",
      icon: Activity,
      valueClassName: "text-sky-600 dark:text-sky-400",
      iconBg: "from-sky-600/15 to-blue-600/15",
    },
    {
      title: "Ingresos Totales",
      value: safeFinance ? `$${Number(safeFinance.revenue.totalIngresos).toLocaleString()}` : "-",
      loading: isLoading,
      trend: null,
      description: "Ventas + servicios consolidados",
      icon: Wallet,
      valueClassName: "text-emerald-600 dark:text-emerald-400",
      iconBg: "from-emerald-600/15 to-green-600/15",
    },
    {
      title: "Licencias por Vencer",
      value: safeSystem?.licenses.expiringSoon ?? 0,
      loading: isLoading,
      trend: null,
      description: "Próximos 30 días",
      icon: Clock,
      valueClassName: "text-amber-600 dark:text-amber-400",
      iconBg: "from-amber-600/15 to-orange-600/15",
    },
    {
      title: "Licencias Activas",
      value: safeSystem?.licenses.active ?? 0,
      loading: isLoading,
      trend: null,
      description: `de ${safeSystem?.licenses.total ?? 0} totales`,
      icon: Shield,
      valueClassName: "text-violet-600 dark:text-violet-400",
      iconBg: "from-violet-600/15 to-purple-600/15",
    },
  ]

  const alerts = ((): SystemAlert[] => {
    const items: SystemAlert[] = []
    if (system && system.licenses.expiringSoon > 0) {
      items.push({
        id: "expiring",
        severity: "warning",
        message: `${system.licenses.expiringSoon} licencias están por vencer en los próximos 30 días`,
        time: "Ahora",
      })
    }
    return items
  })()

  const handleRefresh = async () => {
    const [r1,r2,r3]=await Promise.all([getAdminTenantsAction(), getAdminFinanceAction(), getAdminSystemHealthAction()])
    if(r1.success) setTenants(r1.data??[]); if(r2.success) setFinance(r2.data); if(r3.success) setSystem(r3.data)
  }

  return (
    <PageTransition className="relative min-h-screen w-full">
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <motion.div
          className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl dark:bg-violet-500/5"
          animate={{ scale: [1, 1.1, 1], x: [0, 20, 0], y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl dark:bg-purple-500/5"
          animate={{ scale: [1, 1.15, 1], x: [0, -30, 0], y: [0, 30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
      </div>

      <StaggerContainer className="flex flex-1 flex-col">
        <StaggerItem className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          {/* Header */}
          <motion.div
            className="flex items-center gap-3 px-4 lg:px-6"
            variants={titleVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div
              className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-purple-600 shadow-lg"
              variants={headerIconVariants}
              initial="initial"
              whileHover="hover"
            >
              <Shield className="h-6 w-6 text-white" />
              <motion.div
                className="absolute inset-0 rounded-xl bg-linear-to-tr from-transparent via-white/20 to-transparent"
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                style={{ mixBlendMode: "overlay" }}
              />
            </motion.div>
            <div>
              <motion.h1
                className="text-2xl font-bold bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                Panel de Control
              </motion.h1>
              <motion.p
                className="text-muted-foreground text-sm"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                Visión general del sistema
              </motion.p>
            </div>

            <motion.div
              className="ml-auto flex flex-col gap-2 sm:flex-row"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
            >
              {lastUpdated && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Actualizado: {lastUpdated.toLocaleTimeString('es-CU')}</span>
                </div>
              )}
              <Button
                onClick={handleRefresh}
                variant="outline"
                disabled={isLoading}
                className="border-slate-200/70 bg-white/70 backdrop-blur-sm transition-all duration-200 hover:shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                {isLoading ? "Cargando..." : "Actualizar"}
              </Button>
            </motion.div>
          </motion.div>

          {/* KPI Cards */}
          <motion.div
            className="grid grid-cols-1 gap-4 px-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 lg:px-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            {kpiCards.map((card) => {
              const Icon = card.icon
              return (
                <AnimatedCard key={card.title} className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 mt-4">
                    <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                    <div className={`rounded-md bg-linear-to-br ${card.iconBg} p-2`}>
                      <Icon className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    </div>
                  </CardHeader>
                  <CardContent className="mb-4">
                    {card.loading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Cargando...</span>
                      </div>
                    ) : (
                      <>
                        <div className={`text-2xl font-bold ${card.valueClassName}`}>
                          {typeof card.value === "number" ? card.value.toLocaleString() : card.value}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-muted-foreground">{card.description}</p>
                          {card.trend && (
                            <div className={`flex items-center gap-0.5 text-xs ${
                              card.trend.direction === 'up' ? 'text-emerald-600 dark:text-emerald-400' :
                              card.trend.direction === 'down' ? 'text-rose-600 dark:text-rose-400' :
                              'text-muted-foreground'
                            }`}>
                              {card.trend.direction === 'up' && <ArrowUpRight className="h-3 w-3" />}
                              {card.trend.direction === 'down' && <ArrowDownRight className="h-3 w-3" />}
                              <span>{card.trend.value}%</span>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </AnimatedCard>
              )
            })}
          </motion.div>

          {/* Trend Charts */}
          <motion.div
            className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            {/* Revenue Trend */}
            <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                  Tendencia de Ingresos (Últimos 7 días)
                </CardTitle>
                <CardDescription>Evolución diaria de ventas y servicios</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (safeFinance?.revenueTrend?.length ?? 0) > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Total: ${safeFinance.revenueTrend.reduce((sum: number, d: { ingresos: number }) => sum + d.ingresos, 0).toLocaleString()}</span>
                      <span>Promedio: ${Math.round(safeFinance.revenueTrend.reduce((sum: number, d: { ingresos: number }) => sum + d.ingresos, 0) / safeFinance.revenueTrend.length).toLocaleString()}/día</span>
                    </div>
                    <div className="h-32 flex items-end gap-1">
                      {safeFinance.revenueTrend.map((day: { fecha: string; ingresos: number }, idx: number) => {
                        const maxIngresos = Math.max(...safeFinance.revenueTrend.map((d: { ingresos: number }) => d.ingresos));
                        const height = maxIngresos > 0 ? (day.ingresos / maxIngresos) * 100 : 0;
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                            <div className="w-full bg-emerald-500/20 dark:bg-emerald-500/30 rounded-t-sm relative overflow-hidden" style={{ height: `${height}%` }}>
                              <div className="absolute inset-0 bg-gradient-to-t from-emerald-500 to-emerald-400 opacity-80 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <span className="text-[10px] text-muted-foreground">{day.fecha.slice(5)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    No hay datos de ingresos disponibles
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Users Trend */}
            <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-violet-600" />
                  Nuevos Usuarios (Últimos 7 días)
                </CardTitle>
                <CardDescription>Registros diarios de usuarios</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (safeSystem?.usersTrend?.length ?? 0) > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Total: {safeSystem.usersTrend.reduce((sum: number, d: { usuarios: number }) => sum + d.usuarios, 0)}</span>
                      <span>Promedio: {(safeSystem.usersTrend.reduce((sum: number, d: { usuarios: number }) => sum + d.usuarios, 0) / safeSystem.usersTrend.length).toFixed(1)}/día</span>
                    </div>
                    <div className="h-32 flex items-end gap-1">
                      {safeSystem.usersTrend.map((day: { fecha: string; usuarios: number }, idx: number) => {
                        const maxUsers = Math.max(...safeSystem.usersTrend.map((d: { usuarios: number }) => d.usuarios));
                        const height = maxUsers > 0 ? (day.usuarios / maxUsers) * 100 : 0;
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                            <div className="w-full bg-violet-500/20 dark:bg-violet-500/30 rounded-t-sm relative overflow-hidden" style={{ height: `${height}%` }}>
                              <div className="absolute inset-0 bg-gradient-to-t from-violet-500 to-violet-400 opacity-80 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <span className="text-[10px] text-muted-foreground">{day.fecha.slice(5)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    No hay datos de usuarios disponibles
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Two-column layout: Tenant Distribution + Alerts */}
          <div className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6">
            {/* Users by Role */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UserCheck className="h-4 w-4 text-violet-600" />
                    Usuarios por Rol
                  </CardTitle>
                  <CardDescription>Distribución global de roles</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {safeSystem.users.byRole.map((r: any) => {
                        const pct = safeSystem.users.total > 0
                          ? Math.round((r.count / safeSystem.users.total) * 100)
                          : 0
                        const colors: Record<string, string> = {
                          admin: "bg-violet-500",
                          regularUser: "bg-slate-500",
                          dependiente: "bg-slate-500",
                        }
                        return (
                          <div key={r.role} className="flex items-center justify-between">
                            <span className="text-sm capitalize">{r.role}</span>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                                <div
                                  className={`h-full rounded-full ${colors[r.role] ?? "bg-slate-500"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium w-12 text-right">{r.count}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Alerts */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.5 }}
            >
              <Card className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Alertas del Sistema
                  </CardTitle>
                  <CardDescription>Problemas que requieren atención</CardDescription>
                </CardHeader>
                <CardContent>
                  {alerts.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <Shield className="h-8 w-8 text-emerald-500" />
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        Sin alertas activas
                      </p>
                      <p className="text-xs text-muted-foreground">El sistema funciona con normalidad</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {alerts.map((alert) => {
                        const config = severityConfig[alert.severity]
                        return (
                          <div key={alert.id} className={`flex items-start gap-3 rounded-lg border p-3 ${config.bg}`}>
                            <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${config.dot}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{alert.message}</p>
                              <p className="text-xs text-muted-foreground">{alert.time}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Tenant consumption stats */}
          <motion.div
            className="grid grid-cols-1 gap-4 px-4 lg:grid-cols-2 lg:px-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <AnimatedCard className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Globe className="h-4 w-4 text-violet-600" />
                  Distribución de Tenants por Plan
                </CardTitle>
                <CardDescription>Planes activos por empresa</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {safeTenants.map((t) => (
                      <div key={t.tenantId} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                        <span className="font-medium truncate flex-1">{t.nombre}</span>
                        <span className="text-xs text-muted-foreground mx-2">{t.totalUsers ?? 0} users</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${t.licenseActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"}`}>
                          {t.plan || "Sin plan"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </AnimatedCard>

            <AnimatedCard className="rounded-xl border bg-card/80 backdrop-blur-sm shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-violet-600" />
                  Resumen Financiero
                </CardTitle>
                <CardDescription>Métricas consolidadas de la plataforma</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : safeFinance ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/10 p-3">
                      <p className="text-xs text-muted-foreground">Ingresos Totales</p>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        ${Number(safeFinance.revenue.totalIngresos).toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-amber-50/50 dark:bg-amber-950/10 p-3">
                      <p className="text-xs text-muted-foreground">Gastos</p>
                      <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                        ${Number(safeFinance.gastos.totalMonto).toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-rose-50/50 dark:bg-rose-950/10 p-3">
                      <p className="text-xs text-muted-foreground">Cuentas por Cobrar</p>
                      <p className="text-lg font-bold text-rose-600 dark:text-rose-400">
                        ${Number(safeFinance.cuentasPorCobrar.saldoPendiente).toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-blue-50/50 dark:bg-blue-950/10 p-3">
                      <p className="text-xs text-muted-foreground">Cuentas por Pagar</p>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        ${Number(safeFinance.cuentasPorPagar.saldoPendiente).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    No hay datos financieros disponibles
                  </div>
                )}
              </CardContent>
            </AnimatedCard>
          </motion.div>
        </StaggerItem>
      </StaggerContainer>
    </PageTransition>
  )
}
