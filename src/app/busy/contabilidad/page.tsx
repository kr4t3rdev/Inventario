'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import React, { useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  ArrowUpDown,
  Banknote,
  Building2,
  Calculator,
  CreditCard,
  FileText,
  Receipt,
  Settings,
  SlidersHorizontal,
  ChevronRight,
  PieChart,
  CheckCircle2
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
  AnimatedCard
} from '@/components/ui/animations';
import {
  useGetGastosPendientesQuery,
  useGetMonedasQuery,
  useGetServiciosPendientesQuery,
  useGetTasasActualesQuery,
  useGetVentasPendientesQuery,
} from '@/lib/redux/contabilidad';
import { cn } from '@/lib/utils';

import type { Moneda } from '../../models/model';

const ResumenFinanciero = dynamic(() =>
  import('@/components/contabilidad/resumen-financiero').then((mod) => ({
    default: mod.ResumenFinanciero,
  })),
  { 
    loading: () => <ResumenSkeleton />
  }
);

function ResumenSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
           <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
           <div className="h-8 w-64 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
           <div className="h-4 w-96 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
           <div className="h-9 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
           <div className="h-9 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
        </div>
      </div>

      {/* Cards Skeleton */}
      <div className="grid gap-6 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
        ))}
      </div>
       {/* Secondary Cards Skeleton */}
      <div className="grid gap-6 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// --- Style Configurations ---
const accentStyles = {
  blue: {
    gradient: 'from-blue-500/20 via-blue-500/5 to-transparent dark:from-blue-400/20 dark:via-blue-400/5',
    icon: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    border: 'group-hover:border-blue-500/50 dark:group-hover:border-blue-400/50',
  },
  emerald: {
    gradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent dark:from-emerald-400/20 dark:via-emerald-400/5',
    icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    border: 'group-hover:border-emerald-500/50 dark:group-hover:border-emerald-400/50',
  },
  purple: {
    gradient: 'from-purple-500/20 via-purple-500/5 to-transparent dark:from-purple-400/20 dark:via-purple-400/5',
    icon: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    border: 'group-hover:border-purple-500/50 dark:group-hover:border-purple-400/50',
  },
  amber: {
    gradient: 'from-amber-500/20 via-amber-500/5 to-transparent dark:from-amber-400/20 dark:via-amber-400/5',
    icon: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    border: 'group-hover:border-amber-500/50 dark:group-hover:border-amber-400/50',
  },
  orange: {
    gradient: 'from-orange-500/20 via-orange-500/5 to-transparent dark:from-orange-400/20 dark:via-orange-400/5',
    icon: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    border: 'group-hover:border-orange-500/50 dark:group-hover:border-orange-400/50',
  },
  slate: {
    gradient: 'from-slate-500/20 via-slate-500/5 to-transparent dark:from-slate-400/20 dark:via-slate-400/5',
    icon: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    border: 'group-hover:border-slate-400/50 dark:group-hover:border-slate-500/50',
  },
} as const;

const sectionKickerClass = "text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2";

/**
 * @description Dashboard principal de contabilidad con resumen financiero y módulos clave.
 * @returns {JSX.Element} Vista del dashboard de contabilidad.
 */
export default function ContabilidadDashboard(): React.JSX.Element {
  const [fechaInicio] = useState('');
  const [fechaFin] = useState('');
  const shouldReduceMotion = useReducedMotion();

  // --- Configuration ---
  const quickActions = [
    {
      title: 'Cuentas Bancarias',
      description: 'Gestión de saldos y cuentas',
      href: '/busy/contabilidad/cuentas',
      icon: Building2,
      tone: 'blue',
    },
    {
      title: 'Reconciliación',
      description: 'Conciliar movimientos pendientes',
      href: '/busy/contabilidad/reconciliacion',
      icon: Receipt,
      tone: 'emerald',
    },
    {
      title: 'Transferencias',
      description: 'Mover fondos entre cuentas',
      href: '/busy/contabilidad/transferencias',
      icon: ArrowUpDown,
      tone: 'purple',
    },
    {
      title: 'Ajustes Manuales',
      description: 'Correcciones y notas de débito/crédito',
      href: '/busy/contabilidad/ajustes',
      icon: SlidersHorizontal,
      tone: 'amber',
    },
    {
      title: 'Tasas de Cambio',
      description: 'Configurar valores de monedas',
      href: '/busy/contabilidad/exchange',
      icon: Banknote,
      tone: 'orange',
    },
    {
      title: 'Auditoría',
      description: 'Historial de operaciones',
      href: '/busy/contabilidad/logs',
      icon: FileText,
      tone: 'slate',
    },
  ] as const;

  // --- Data Fetching (Summary Stats) ---
  const { data: responseVentas } = useGetVentasPendientesQuery({ fechaInicio, fechaFin });
  const { data: serviciosPendientesData } = useGetServiciosPendientesQuery({ fechaDesde: fechaInicio || undefined, fechaHasta: fechaFin || undefined });
  const { data: response } = useGetGastosPendientesQuery({ fechaDesde: fechaInicio, fechaHasta: fechaFin, soloNoReconciliados: true });
  const { data: monedasData } = useGetMonedasQuery();

  const monedasPrincipal = monedasData?.data?.find((m: any) => m.esPrincipal)?.codigo || 'CUP';
  const ventasPendientes = responseVentas?.ventas?.filter((v: any) => !v.reconciliada) ?? [];
  const cantVentasPendientes = ventasPendientes.length;
  
  const serviciosList = serviciosPendientesData?.ventaServicios;
  const cantServiciosPendientes = (serviciosList?.filter((s) => !s.reconciliada) ?? []).length;
  
  const gastosVisibles = response?.gastos;
  const gastosPendientes = gastosVisibles?.length ?? 0;
  
  const totalPendientes = cantVentasPendientes + cantServiciosPendientes + gastosPendientes;

  const reconciliationModules = [
    {
      title: 'Ventas',
      description: 'Facturas por conciliar',
      href: '/busy/contabilidad/reconciliacion/ventas',
      icon: Receipt,
      pendingCount: cantVentasPendientes,
      tone: 'blue',
    },
    {
      title: 'Servicios',
      description: 'Servicios prestados',
      href: '/busy/contabilidad/reconciliacion/servicios',
      icon: CreditCard,
      pendingCount: cantServiciosPendientes,
      tone: 'emerald',
    },
    {
      title: 'Gastos',
      description: 'Salarios y operativos',
      href: '/busy/contabilidad/reconciliacion/gastos',
      icon: Calculator,
      pendingCount: gastosPendientes,
      tone: 'amber',
    },
  ] as const;

  return (
    <PageTransition className="relative min-h-screen w-full bg-slate-50/50 dark:bg-slate-950">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl dark:bg-blue-500/5 mix-blend-multiply dark:mix-blend-screen animate-blob" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl dark:bg-purple-500/5 mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl dark:bg-emerald-500/5 mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-4000" />
      </div>

      <StaggerContainer className="container mx-auto p-6 space-y-10">
        
        {/* Header */}
        <StaggerItem className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              Contabilidad
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
              Gestión financiera integral, control de cuentas y conciliación bancaria.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              asChild
              variant="outline"
              className="border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <Link href="/busy/contabilidad/reportes" className="flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                Reportes
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <Link href="/busy/contabilidad/configuracion" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configuración
              </Link>
            </Button>
          </div>
        </StaggerItem>

        {/* Resumen Financiero Component */}
        <StaggerItem>
          <ResumenFinanciero periodo="mes" page={1} limit={10} />
        </StaggerItem>

        <StaggerItem>
          <Separator className="bg-slate-200 dark:bg-slate-800" />
        </StaggerItem>

        {/* Reconciliation Center */}
        <StaggerItem className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className={sectionKickerClass}>Conciliación</p>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                Centro de Actividad
              </h2>
            </div>
            {totalPendientes > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {totalPendientes} Pendientes Total
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reconciliationModules.map((module) => {
              const styles = accentStyles[module.tone];
              return (
                <Link key={module.href} href={module.href} className="group block h-full">
                  <AnimatedCard className="h-full">
                    <Card className={cn(
                      "h-full overflow-hidden transition-all duration-300 border-slate-200 dark:border-slate-800",
                      "hover:shadow-lg dark:hover:shadow-blue-900/10",
                      styles.border
                    )}>
                      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500", styles.gradient)} />
                      <CardHeader>
                        <div className="flex justify-between items-start mb-2">
                          <div className={cn("p-3 rounded-xl transition-colors duration-300", styles.icon)}>
                            <module.icon className="h-6 w-6" />
                          </div>
                          {module.pendingCount > 0 ? (
                            <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {module.pendingCount} pendientes
                            </Badge>
                          ) : (
                            <div className="text-emerald-500 dark:text-emerald-400">
                              <CheckCircle2 className="h-6 w-6" />
                            </div>
                          )}
                        </div>
                        <CardTitle className="text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {module.title}
                        </CardTitle>
                        <CardDescription className="line-clamp-2">
                          {module.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0 duration-300">
                          Gestionar <ChevronRight className="ml-1 h-4 w-4" />
                        </div>
                      </CardContent>
                    </Card>
                  </AnimatedCard>
                </Link>
              );
            })}
          </div>
        </StaggerItem>

        {/* Quick Actions Grid */}
        <StaggerItem className="space-y-6">
          <div>
            <p className={sectionKickerClass}>Accesos Directos</p>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Gestión General
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {quickActions.map((action) => {
              const styles = accentStyles[action.tone];
              return (
                <Link key={action.href} href={action.href} className="group">
                  <AnimatedCard className="h-full" hoverEffect={false}>
                    <Card className={cn(
                      "h-full overflow-hidden border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50",
                      "hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300",
                      "hover:shadow-md dark:hover:shadow-slate-900/20"
                    )}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className={cn("p-2.5 rounded-lg shrink-0 transition-transform group-hover:scale-110 duration-300", styles.icon)}>
                          <action.icon className="h-5 w-5" />
                        </div>
                        <div className="overflow-hidden">
                          <h3 className="font-medium text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {action.title}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {action.description}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </AnimatedCard>
                </Link>
              );
            })}
          </div>
        </StaggerItem>
      </StaggerContainer>
    </PageTransition>
  );
}

