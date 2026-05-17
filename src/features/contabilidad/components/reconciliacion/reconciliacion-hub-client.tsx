"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { LazyMotion, m as motion, useReducedMotion } from "framer-motion"
import { AlertCircle, ArrowLeft, Calculator, CheckCircle2, CreditCard, Receipt, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getReconciliacionStatsAction } from "@/features/contabilidad/actions-reconciliacion"
import { cn } from "@/lib/utils"

type ToneKey = "emerald" | "blue" | "amber"

const accentStyles: Record<ToneKey, { gradient: string; icon: string; badge: string; border: string }> = {
  emerald: {
    gradient: cn("bg-linear-to-br from-emerald-500/20 via-emerald-500/10 to-transparent", "dark:from-emerald-400/25 dark:via-emerald-400/10"),
    icon: cn("bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20", "dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/30"),
    badge: cn("bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20", "dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/30"),
    border: "hover:border-emerald-500/40 dark:hover:border-emerald-400/40",
  },
  blue: {
    gradient: cn("bg-linear-to-br from-blue-500/20 via-blue-500/10 to-transparent", "dark:from-blue-400/25 dark:via-blue-400/10"),
    icon: cn("bg-blue-500/10 text-blue-700 ring-1 ring-blue-500/20", "dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/30"),
    badge: cn("bg-blue-500/10 text-blue-700 ring-1 ring-blue-500/20", "dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/30"),
    border: "hover:border-blue-500/40 dark:hover:border-blue-400/40",
  },
  amber: {
    gradient: cn("bg-linear-to-br from-amber-500/25 via-amber-500/10 to-transparent", "dark:from-amber-400/25 dark:via-amber-400/10"),
    icon: cn("bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20", "dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/30"),
    badge: cn("bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20", "dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/30"),
    border: "hover:border-amber-500/40 dark:hover:border-amber-400/40",
  },
}

const sectionKickerClass = cn("text-xs font-semibold uppercase tracking-[0.3em] text-slate-500", "dark:text-slate-400")
const surfaceCardClass = cn("group relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg", "dark:border-slate-800/60 dark:bg-slate-900/10")
const staticCardClass = cn("relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm", "dark:border-slate-800/60 dark:bg-slate-900/10")
const metaBadgeClass = cn("border border-slate-200/70 bg-white/80 text-slate-700 shadow-sm", "dark:border-slate-800/60 dark:bg-slate-900/10 dark:text-slate-200")
const outlineButtonClass = cn("border-slate-200/70 bg-white/80 text-slate-700 shadow-sm transition-all", "dark:border-slate-800/60 dark:bg-slate-900/10 dark:text-slate-200")
const bodyTextClass = "text-sm text-slate-600 dark:text-slate-300"
const progressTrackClass = cn("bg-slate-200/70 dark:bg-slate-800/70")

function ReconciliacionHubSkeleton() {
  return (
    <div className="space-y-8 p-8">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-20" />
        <div><Skeleton className="mb-2 h-8 w-64" /><Skeleton className="h-4 w-96" /></div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-[260px] w-full" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[100px] w-full" />)}
      </div>
      <Skeleton className="h-[320px] w-full" />
    </div>
  )
}

/**
 * @description Componente cliente para el hub de reconciliación.
 * Maneja polling y data fetching via Server Action.
 */
export function ReconciliacionHubClient({ initialStats }: { initialStats: any }) {
  const shouldReduceMotion = useReducedMotion()
  const [statsData, setStatsData] = useState(initialStats)
  const [isLoading, setIsLoading] = useState(!initialStats)
  const [error, setError] = useState(false)

  const loadStats = async () => {
    const r = await getReconciliacionStatsAction()
    if (r.success) { setStatsData(r.data); setError(false) }
    else setError(true)
    setIsLoading(false)
  }

  useEffect(() => {
    if (!initialStats) loadStats()
    const interval = setInterval(loadStats, 30000) // Polling cada 30s
    return () => clearInterval(interval)
  }, [])

  const fadeIn = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: shouldReduceMotion ? 0 : 0.3, ease: "easeOut" as const } },
  }
  const fadeInUp = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 16 },
    show: { opacity: 1, y: 0, transition: { duration: shouldReduceMotion ? 0 : 0.35, ease: "easeOut" as const } },
  }
  const stagger = { hidden: {}, show: { transition: { staggerChildren: shouldReduceMotion ? 0 : 0.08 } } }

  const getProgress = (completed: number, total: number) => total > 0 ? (completed / total) * 100 : 0
  const fmtCurrency = (amount: number | string, currency = "CUP") =>
    `${currency} ${Number(amount).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const min = Math.floor(diff / 60000)
    if (min < 1) return "ahora mismo"
    if (min < 60) return `hace ${min} min`
    const hrs = Math.floor(min / 60)
    if (hrs < 24) return `hace ${hrs} h`
    return `hace ${Math.floor(hrs / 24)} d`
  }

  const modules = statsData?.modules || { ventas: { pending: 0, completedToday: 0, totalToday: 0 }, servicios: { pending: 0, completedToday: 0, totalToday: 0 }, gastos: { pending: 0, completedToday: 0, totalToday: 0 } }
  const stats = statsData?.stats || { totalPending: 0, completedToday: 0, reconciledAmount: 0, efficiency: 0 }
  const recentActivity = Array.isArray(statsData?.recentActivity) ? statsData.recentActivity : []

  const reconciliationModules = [
    { title: "Ventas", desc: "Asigna ventas del sistema a cuentas bancarias.", href: "/busy/contabilidad/reconciliacion/ventas", icon: Receipt, ...modules.ventas, tone: "emerald" as ToneKey },
    { title: "Servicios", desc: "Reconcilia servicios facturados con pagos recibidos.", href: "/busy/contabilidad/reconciliacion/servicios", icon: CreditCard, ...modules.servicios, tone: "blue" as ToneKey },
    { title: "Gastos", desc: "Reconcilia salarios y gastos operativos.", href: "/busy/contabilidad/reconciliacion/gastos", icon: Calculator, ...modules.gastos, tone: "amber" as ToneKey },
  ]

  if (isLoading) return <SidebarProvider><SidebarInset className="bg-background"><ReconciliacionHubSkeleton /></SidebarInset></SidebarProvider>

  if (error) return (
    <SidebarProvider><SidebarInset className="bg-background">
      <motion.div className="relative space-y-6 p-8" variants={fadeIn} initial="hidden" animate="show">
        <Button variant="ghost" size="sm" asChild><Link href="/busy/contabilidad"><ArrowLeft className="mr-2 h-4 w-4" />Volver</Link></Button>
        <Card className={staticCardClass}><CardContent className="py-10 text-center"><p className="text-sm text-red-600">Error al cargar los datos.</p></CardContent></Card>
      </motion.div>
    </SidebarInset></SidebarProvider>
  )

  return (
    <SidebarProvider>
      <SidebarInset className="bg-background">
        <motion.div className="relative space-y-8 p-8" variants={fadeIn} initial="hidden" animate="show">
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
            <motion.section variants={fadeInUp} className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex items-start gap-4">
                <Button variant="ghost" size="sm" asChild className="mt-1"><Link href="/busy/contabilidad"><ArrowLeft className="mr-2 h-4 w-4" />Volver</Link></Button>
                <div className="space-y-1">
                  <p className={sectionKickerClass}>Centro operativo</p>
                  <h1 className="bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-3xl font-semibold tracking-tight text-transparent dark:from-white dark:to-slate-300">Reconciliación</h1>
                  <p className={bodyTextClass}>Supervisa pendientes de ventas, servicios y gastos en una sola vista.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={metaBadgeClass}>Pendientes: {stats.totalPending}</Badge>
                <Badge className={metaBadgeClass}>Completados hoy: {stats.completedToday}</Badge>
                <Badge className={metaBadgeClass}>Eficiencia: {stats.efficiency}%</Badge>
              </div>
            </motion.section>

            <motion.section className="space-y-4" variants={fadeInUp}>
              <div className="space-y-1">
                <p className={sectionKickerClass}>Módulos</p>
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Flujos de conciliación</h2>
                <p className={bodyTextClass}>Accede al detalle por tipo y continúa donde hay prioridad.</p>
              </div>
              <motion.div className="grid grid-cols-1 gap-4 lg:grid-cols-3" variants={stagger}>
                {reconciliationModules.map((mod) => {
  // @ts-expect-error
                  const s = accentStyles[mod.tone]
                  const progress = getProgress(mod.completedToday, mod.totalToday)
                  return (
                    <motion.div key={mod.href} variants={fadeInUp} className="h-full">
                      <Card className={cn(surfaceCardClass, s.border)}>
                        <CardHeader className="relative z-10 pb-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", s.icon)}><mod.icon className="h-5 w-5" /></span>
                              <div><CardTitle className="text-lg">{mod.title}</CardTitle><CardDescription className={bodyTextClass}>{mod.desc}</CardDescription></div>
                            </div>
                            {mod.pending > 0 && <Badge className={cn("h-6 px-2 text-xs", s.badge)}>{mod.pending}</Badge>}
                          </div>
                        </CardHeader>
                        <CardContent className="relative z-10 space-y-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span>Progreso del día</span>
                              <span className="font-medium">{mod.completedToday}/{mod.totalToday}</span>
                            </div>
                            <Progress value={progress} className={progressTrackClass} />
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="h-4 w-4" />{mod.completedToday} completados</span>
                            <span className="flex items-center gap-2 text-amber-600"><AlertCircle className="h-4 w-4" />{mod.pending} pendientes</span>
                          </div>
                          <Button asChild variant="outline" className={cn(outlineButtonClass, "w-full")}><Link href={mod.href}>Gestionar {mod.title}</Link></Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </motion.div>
            </motion.section>

            <motion.section variants={fadeInUp} className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {[
                { label: "Total pendientes", value: stats.totalPending, color: "text-amber-600" },
                { label: "Completados hoy", value: stats.completedToday, color: "text-emerald-600" },
                { label: "Monto reconciliado", value: fmtCurrency(stats.reconciledAmount), color: "text-slate-900" },
                { label: "Eficiencia", value: `${stats.efficiency}%`, color: "text-blue-600" },
              ].map((item, i) => (
                <motion.div key={i} variants={fadeInUp}>
                  <Card className={staticCardClass}>
                    <CardHeader className="pb-2">
                      <CardDescription>{item.label}</CardDescription>
                      <CardTitle className={`text-2xl ${item.color}`}>{item.value}</CardTitle>
                    </CardHeader>
                  </Card>
                </motion.div>
              ))}
            </motion.section>

            <motion.section variants={fadeInUp}>
              <Card className={staticCardClass}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-blue-500" /> Actividad reciente</CardTitle>
                  <CardDescription>Últimas conciliaciones realizadas.</CardDescription>
                </CardHeader>
                <CardContent>
                  {recentActivity.length === 0 ? (
                    <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">No hay actividad reciente.</div>
                  ) : (
                    <div className="space-y-3">
                      {recentActivity.map((a: any) => (
                        <div key={a.id} className="flex items-center justify-between rounded-lg border px-3 py-3 text-sm">
                          <div className="flex items-center gap-3">
                            {a.type === "venta" && <Receipt className="h-4 w-4 text-emerald-600" />}
                            {a.type === "servicio" && <CreditCard className="h-4 w-4 text-blue-600" />}
                            {a.type === "gasto" && <Calculator className="h-4 w-4 text-amber-600" />}
                            <div><p className="font-medium">{a.reference}</p><p className="text-xs text-muted-foreground">{a.description} - {a.accountName}</p></div>
                          </div>
                          <div className="text-right"><p className="font-medium">{fmtCurrency(a.amount)}</p><p className="text-xs text-muted-foreground">{fmtTimeAgo(a.date)}</p></div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.section>
          </motion.div>
        </motion.div>
      </SidebarInset>
    </SidebarProvider>
  )
}
