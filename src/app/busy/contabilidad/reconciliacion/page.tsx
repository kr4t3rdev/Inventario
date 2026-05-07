'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  Calculator,
  CheckCircle2,
  CreditCard,
  Receipt,
  TrendingUp,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useGetReconciliacionStatsQuery } from '@/features/contabilidad/api/contabilidadApi';
import { cn } from '@/lib/utils';

type ToneKey = 'emerald' | 'blue' | 'amber';

const accentStyles: Record<
  ToneKey,
  {
    gradient: string;
    icon: string;
    badge: string;
    border: string;
  }
> = {
  emerald: {
    gradient: cn(
      'bg-linear-to-br from-emerald-500/20 via-emerald-500/10 to-transparent',
      'dark:from-emerald-400/25 dark:via-emerald-400/10',
    ),
    icon: cn(
      'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20',
      'dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/30',
    ),
    badge: cn(
      'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20',
      'dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/30',
    ),
    border: 'hover:border-emerald-500/40 dark:hover:border-emerald-400/40',
  },
  blue: {
    gradient: cn(
      'bg-linear-to-br from-blue-500/20 via-blue-500/10 to-transparent',
      'dark:from-blue-400/25 dark:via-blue-400/10',
    ),
    icon: cn(
      'bg-blue-500/10 text-blue-700 ring-1 ring-blue-500/20',
      'dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/30',
    ),
    badge: cn(
      'bg-blue-500/10 text-blue-700 ring-1 ring-blue-500/20',
      'dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/30',
    ),
    border: 'hover:border-blue-500/40 dark:hover:border-blue-400/40',
  },
  amber: {
    gradient: cn(
      'bg-linear-to-br from-amber-500/25 via-amber-500/10 to-transparent',
      'dark:from-amber-400/25 dark:via-amber-400/10',
    ),
    icon: cn(
      'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20',
      'dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/30',
    ),
    badge: cn(
      'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20',
      'dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/30',
    ),
    border: 'hover:border-amber-500/40 dark:hover:border-amber-400/40',
  },
};

const sectionKickerClass = cn(
  'text-xs font-semibold uppercase tracking-[0.3em] text-slate-500',
  'dark:text-slate-400',
);

const surfaceCardClass = cn(
  'group relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm',
  'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg',
  'dark:border-slate-800/60 dark:bg-slate-900/10',
);

const staticCardClass = cn(
  'relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm',
  'dark:border-slate-800/60 dark:bg-slate-900/10',
);

const metaBadgeClass = cn(
  'border border-slate-200/70 bg-white/80 text-slate-700 shadow-sm',
  'dark:border-slate-800/60 dark:bg-slate-900/10 dark:text-slate-200',
);

const outlineButtonClass = cn(
  'border-slate-200/70 bg-white/80 text-slate-700 shadow-sm transition-all',
  'dark:border-slate-800/60 dark:bg-slate-900/10 dark:text-slate-200',
);

const bodyTextClass = 'text-sm text-slate-600 dark:text-slate-300';
const progressTrackClass = cn('bg-slate-200/70 dark:bg-slate-800/70');

/**
 * @description Dashboard central para gestionar reconciliación de ventas, servicios y gastos.
 * @returns {JSX.Element} Vista principal de reconciliación.
 */
export default function ReconciliacionHubPage(): React.JSX.Element {
  const shouldReduceMotion = useReducedMotion();
  const { data: statsData, isLoading, error } = useGetReconciliacionStatsQuery(undefined, {
    pollingInterval: 30000,
  });

  const fadeIn = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.3,
        ease: 'easeOut' as const,
      },
    },
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.35,
        ease: 'easeOut' as const,
      },
    },
  };

  const stagger = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.08,
      },
    },
  };

  /**
   * @description Calcula porcentaje de avance diario por módulo.
   * @param {number} completed - Cantidad completada.
   * @param {number} total - Total del día.
   * @returns {number} Progreso entre 0 y 100.
   */
  const getProgressPercentage = (completed: number, total: number): number => {
    return total > 0 ? (completed / total) * 100 : 0;
  };

  /**
   * @description Formatea monto monetario para mostrar en UI.
   * @param {number | string} amount - Monto a formatear.
   * @param {string} currency - Moneda de referencia.
   * @returns {string} Monto formateado.
   */
  const formatCurrency = (amount: number | string, currency = 'CUP'): string => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

    return `${currency} ${numAmount.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  /**
   * @description Devuelve texto relativo del tiempo transcurrido.
   * @param {Date} date - Fecha de referencia.
   * @returns {string} Texto relativo.
   */
  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) return 'ahora mismo';
    if (diffInMinutes < 60) return `hace ${diffInMinutes} min`;
    if (diffInHours < 24) return `hace ${diffInHours} h`;

    return `hace ${diffInDays} d`;
  };

  const modules = statsData?.modules || {
    ventas: { pending: 0, completedToday: 0, totalToday: 0 },
    servicios: { pending: 0, completedToday: 0, totalToday: 0 },
    gastos: { pending: 0, completedToday: 0, totalToday: 0 },
  };

  const stats = statsData?.stats || {
    totalPending: 0,
    completedToday: 0,
    reconciledAmount: 0,
    efficiency: 0,
  };

  const recentActivity = Array.isArray(statsData?.recentActivity) ? statsData.recentActivity : [];

  const reconciliationModules = [
    {
      title: 'Ventas',
      description: 'Asigna ventas del sistema a cuentas bancarias.',
      href: '/busy/contabilidad/reconciliacion/ventas',
      icon: Receipt,
      pendingCount: modules.ventas.pending,
      completedToday: modules.ventas.completedToday,
      totalToday: modules.ventas.totalToday,
      tone: 'emerald',
    },
    {
      title: 'Servicios',
      description: 'Reconcilia servicios facturados con pagos recibidos.',
      href: '/busy/contabilidad/reconciliacion/servicios',
      icon: CreditCard,
      pendingCount: modules.servicios.pending,
      completedToday: modules.servicios.completedToday,
      totalToday: modules.servicios.totalToday,
      tone: 'blue',
    },
    {
      title: 'Gastos',
      description: 'Reconcilia salarios y gastos operativos.',
      href: '/busy/contabilidad/reconciliacion/gastos',
      icon: Calculator,
      pendingCount: modules.gastos.pending,
      completedToday: modules.gastos.completedToday,
      totalToday: modules.gastos.totalToday,
      tone: 'amber',
    },
  ] as const;

  if (isLoading) {
    return (
      <SidebarProvider>
        <SidebarInset className="bg-background">
          <ReconciliacionHubSkeleton />
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (error) {
    return (
      <SidebarProvider>
        <SidebarInset className="bg-background">
          <motion.div className="relative space-y-6 p-8" variants={fadeIn} initial="hidden" animate="show">
            <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
              <div className="absolute inset-0 bg-linear-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950/5 dark:via-slate-900/5 dark:to-slate-950/5" />
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/busy/contabilidad" className="flex items-center text-slate-600 dark:text-slate-300">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Link>
            </Button>
            <Card className={staticCardClass}>
              <CardContent className="py-10 text-center">
                <p className="text-sm text-red-600 dark:text-red-400">
                  Error al cargar los datos de reconciliación. Intente nuevamente.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <SidebarInset className="bg-background">
        <motion.div className="relative space-y-8 p-8" variants={fadeIn} initial="hidden" animate="show">
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div
              className={cn(
                'absolute inset-0 bg-linear-to-b from-slate-50 via-white to-slate-100',
                'dark:from-slate-950 dark:via-slate-900 dark:to-slate-950',
              )}
            />
            <div
              className={cn(
                'absolute -top-24 right-[-10%] h-72 w-72 rounded-full',
                'bg-linear-to-br from-emerald-400/25 via-blue-500/20 to-transparent',
                'blur-3xl dark:from-emerald-400/20 dark:via-blue-500/25',
              )}
            />
            <div
              className={cn(
                'absolute -bottom-24 left-[-10%] h-72 w-72 rounded-full',
                'bg-linear-to-br from-amber-400/25 via-orange-500/20 to-transparent',
                'blur-3xl dark:from-amber-400/20 dark:via-orange-500/20',
              )}
            />
          </div>

          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
        <motion.section
          className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
          variants={fadeInUp}
        >
          <div className="flex items-start gap-4">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className={cn(
                'mt-1 text-slate-600 transition hover:text-slate-900',
                'dark:text-slate-300 dark:hover:text-white',
              )}
            >
              <Link href="/busy/contabilidad" className="flex items-center">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Link>
            </Button>

            <div className="space-y-1">
              <p className={sectionKickerClass}>Centro operativo</p>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl',
                    'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20',
                    'dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/30',
                  )}
                >
                  <Receipt className="h-5 w-5" />
                </span>
                <h1 className="bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-3xl font-semibold tracking-tight text-transparent dark:from-white dark:to-slate-300">
                  Reconciliación
                </h1>
              </div>
              <p className={bodyTextClass}>
                Supervisa pendientes de ventas, servicios y gastos en una sola vista.
              </p>
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
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Flujos de conciliación
            </h2>
            <p className={bodyTextClass}>Accede al detalle por tipo y continúa donde hay prioridad.</p>
          </div>

          <motion.div className="grid grid-cols-1 gap-4 lg:grid-cols-3" variants={stagger}>
            {reconciliationModules.map((module) => {
              const styles = accentStyles[module.tone];
              const progress = getProgressPercentage(module.completedToday, module.totalToday);

              return (
                <motion.div key={module.href} variants={fadeInUp} className="h-full">
                  <Card className={cn(surfaceCardClass, styles.border)}>
                    <div
                      className={cn(
                        'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300',
                        'group-hover:opacity-100',
                        styles.gradient,
                      )}
                    />
                    <CardHeader className="relative z-10 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              'flex h-10 w-10 items-center justify-center rounded-xl',
                              styles.icon,
                            )}
                          >
                            <module.icon className="h-5 w-5" />
                          </span>
                          <div>
                            <CardTitle className="text-lg text-slate-900 dark:text-white">
                              {module.title}
                            </CardTitle>
                            <CardDescription className={bodyTextClass}>
                              {module.description}
                            </CardDescription>
                          </div>
                        </div>
                        {module.pendingCount > 0 && (
                          <Badge className={cn('h-6 px-2 text-xs', styles.badge)}>
                            {module.pendingCount}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="relative z-10 space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>Progreso del día</span>
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            {module.completedToday}/{module.totalToday}
                          </span>
                        </div>
                        <Progress value={progress} className={progressTrackClass} />
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-300">
                          <CheckCircle2 className="h-4 w-4" />
                          {module.completedToday} completados
                        </span>
                        <span className="flex items-center gap-2 text-amber-600 dark:text-amber-300">
                          <AlertCircle className="h-4 w-4" />
                          {module.pendingCount} pendientes
                        </span>
                      </div>

                      <Button
                        asChild
                        variant="outline"
                        className={cn(
                          outlineButtonClass,
                          'w-full hover:border-blue-500/40 hover:text-slate-900',
                          'dark:hover:border-blue-400/40',
                        )}
                      >
                        <Link href={module.href}>Gestionar {module.title}</Link>
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.section>

        <motion.section className="space-y-4" variants={fadeInUp}>
          <motion.div className="grid grid-cols-1 gap-4 md:grid-cols-4" variants={stagger}>
            <motion.div variants={fadeInUp}>
              <Card className={staticCardClass}>
                <CardHeader className="pb-2">
                  <CardDescription>Total pendientes</CardDescription>
                  <CardTitle className="text-2xl text-amber-600 dark:text-amber-300">
                    {stats.totalPending}
                  </CardTitle>
                </CardHeader>
              </Card>
            </motion.div>
            <motion.div variants={fadeInUp}>
              <Card className={staticCardClass}>
                <CardHeader className="pb-2">
                  <CardDescription>Completados hoy</CardDescription>
                  <CardTitle className="text-2xl text-emerald-600 dark:text-emerald-300">
                    {stats.completedToday}
                  </CardTitle>
                </CardHeader>
              </Card>
            </motion.div>
            <motion.div variants={fadeInUp}>
              <Card className={staticCardClass}>
                <CardHeader className="pb-2">
                  <CardDescription>Monto reconciliado</CardDescription>
                  <CardTitle className="text-2xl text-slate-900 dark:text-white">
                    {formatCurrency(stats.reconciledAmount)}
                  </CardTitle>
                </CardHeader>
              </Card>
            </motion.div>
            <motion.div variants={fadeInUp}>
              <Card className={staticCardClass}>
                <CardHeader className="pb-2">
                  <CardDescription>Eficiencia</CardDescription>
                  <CardTitle className="text-2xl text-blue-600 dark:text-blue-300">
                    {stats.efficiency}%
                  </CardTitle>
                </CardHeader>
              </Card>
            </motion.div>
          </motion.div>
        </motion.section>

        <motion.section variants={fadeInUp}>
          <Card className={staticCardClass}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <span
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl',
                    'bg-blue-500/10 text-blue-700 ring-1 ring-blue-500/20',
                    'dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/30',
                  )}
                >
                  <TrendingUp className="h-5 w-5" />
                </span>
                Actividad reciente
              </CardTitle>
              <CardDescription className={bodyTextClass}>
                Últimas conciliaciones realizadas por el equipo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300/70 py-6 text-center text-sm text-slate-500 dark:border-slate-700/70 dark:text-slate-400">
                    No hay actividad reciente.
                  </div>
                ) : (
                  recentActivity.map((activity: any) => (
                    <div
                      key={activity.id}
                      className={cn(
                        'flex items-center justify-between rounded-lg border px-3 py-3',
                        'border-slate-200/60 bg-white/70 text-sm shadow-sm',
                        'dark:border-slate-800/60 dark:bg-slate-900/10',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {activity.type === 'venta' && (
                          <Receipt className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                        )}
                        {activity.type === 'servicio' && (
                          <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                        )}
                        {activity.type === 'gasto' && (
                          <Calculator className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                        )}
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{activity.reference}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {activity.description} - {activity.accountName}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-slate-900 dark:text-white">
                          {formatCurrency(activity.amount)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatTimeAgo(new Date(activity.date))}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </motion.section>
          </motion.div>
        </motion.div>
      </SidebarInset>
    </SidebarProvider>
  );
}

/**
 * @description Estado de carga para el dashboard de reconciliación.
 * @returns {JSX.Element} Esqueleto visual.
 */
function ReconciliacionHubSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-8 p-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-20" />
        <div>
          <Skeleton className="mb-2 h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-[260px] w-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-[100px] w-full" />
        ))}
      </div>
      <Skeleton className="h-[320px] w-full" />
    </div>
  );
}
