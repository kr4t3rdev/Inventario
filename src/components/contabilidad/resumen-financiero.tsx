'use client';

import { useState, useEffect } from 'react';
import { motion, useReducedMotion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import {
  AlertCircle,
  ArrowUpDown,
  Calculator,
  CheckCircle2,
  CreditCard,
  DollarSign,
  RefreshCw,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
  Activity,
  Calendar,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useGetAjustesByCuentaQuery,
  useGetGastosPendientesQuery,
  useGetHistorialReconciliacionGastosQuery,
  useGetHistorialReconciliacionServiciosQuery,
  useGetHistorialReconciliacionVentasQuery,
  useGetMonedasQuery,
  useGetResumenFinancieroQuery,
  useGetServiciosPendientesQuery,
  useGetTasasActualesQuery,
  useGetTransferenciasBancariasQuery,
  useGetVentasPendientesQuery,
  useInvalidateContabilidadCache,
} from '@/lib/redux/services/contabilidadApi';
import { formatCurrency } from '@/lib/redux/utils/contabilidadUtils';
import { cn } from '@/lib/utils';

import type {
  AjusteBancario,
  GastoPendiente,
  Moneda,
  ReconciliacionVenta,
  TasaCambio,
  TransferenciaBancaria,
  Venta,
  VentaServicio,
} from '@/app/models/model';

// --- Types ---
interface CacheRefreshButtonProps {
  onRefresh?: () => void;
  isLoading?: boolean;
  className?: string;
}

interface ResumenFinancieroProps {
  fechaInicio?: string;
  fechaFin?: string;
  cuentaId?: string;
  tipoGasto?: string;
  periodo: string;
  soloNoReconciliados?: boolean | undefined;
  page: number;
  limit: number;
}

type AccentTone = 'emerald' | 'rose' | 'blue' | 'amber' | 'slate' | 'violet';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// --- Animated Number Component ---
function AnimatedNumber({ value, currency = '', prefix = '', isInteger = false }: { value: number; currency?: string; prefix?: string; isInteger?: boolean }) {
  const spring = useSpring(0, { stiffness: 50, damping: 15 });
  const display = useTransform(spring, (current) => {
    // Format the number as currency
    const formatted = current.toLocaleString('es-ES', {
      minimumFractionDigits: isInteger ? 0 : 2,
      maximumFractionDigits: isInteger ? 0 : 2,
    });
    return `${prefix}${currency ? currency + ' ' : ''}${formatted}`;
  });

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span>{display}</motion.span>;
}

// --- Styles & Constants ---
const toneStyles: Record<AccentTone, { gradient: string; icon: string; text: string; border: string; badge: string }> = {
  emerald: {
    gradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent dark:from-emerald-400/20 dark:via-emerald-400/5',
    icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  rose: {
    gradient: 'from-rose-500/20 via-rose-500/5 to-transparent dark:from-rose-400/20 dark:via-rose-400/5',
    icon: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-800',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  },
  blue: {
    gradient: 'from-blue-500/20 via-blue-500/5 to-transparent dark:from-blue-400/20 dark:via-blue-400/5',
    icon: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  amber: {
    gradient: 'from-amber-500/20 via-amber-500/5 to-transparent dark:from-amber-400/20 dark:via-amber-400/5',
    icon: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  slate: {
    gradient: 'from-slate-500/20 via-slate-500/5 to-transparent dark:from-slate-400/20 dark:via-slate-400/5',
    icon: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-800',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  violet: {
    gradient: 'from-violet-500/20 via-violet-500/5 to-transparent dark:from-violet-400/20 dark:via-violet-400/5',
    icon: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-200 dark:border-violet-800',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  },
};

/**
 * @description Botón reutilizable para refrescar datos de contabilidad.
 */
export function CacheRefreshButton({
  onRefresh,
  isLoading = false,
  className = '',
}: CacheRefreshButtonProps): React.JSX.Element {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onRefresh}
      disabled={isLoading}
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        "border-slate-200 dark:border-slate-700",
        "hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/20",
        className
      )}
    >
      <motion.div
        animate={isLoading ? { rotate: 360 } : { rotate: 0 }}
        transition={{ duration: 1, repeat: isLoading ? Infinity : 0, ease: "linear" }}
        className="mr-2"
      >
        <RefreshCw className="h-4 w-4" />
      </motion.div>
      <span className="relative z-10">{isLoading ? 'Actualizando...' : 'Actualizar'}</span>
      {isLoading && (
        <motion.div
          className="absolute inset-0 bg-blue-500/10 dark:bg-blue-400/10"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </Button>
  );
}

/**
 * @description Componente que muestra el resumen financiero y módulos clave de contabilidad con UI/UX mejorada.
 */
export function ResumenFinanciero({
  fechaInicio,
  fechaFin,
  cuentaId,
  page,
  limit,
  tipoGasto,
  periodo,
  soloNoReconciliados,
}: ResumenFinancieroProps): React.JSX.Element | null {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // --- Animation Variants ---
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        stiffness: 50,
        damping: 15
      }
    }
  };

  const cardHoverVariants = {
    hover: { 
      y: -5, 
      boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)",
      transition: { duration: 0.2 }
    }
  };

  // --- Data Fetching ---
  const { data: resumen, isLoading, error, refetch } = useGetResumenFinancieroQuery({
    fechaInicio,
    fechaFin,
    cuentaId,
  });

  const { data: monedasData } = useGetMonedasQuery();
  const monedas = monedasData?.data || [];

  const { data: tasasActualesData = { data: { monedaPrincipal: {} as Moneda, tasas: [] } } } =
    useGetTasasActualesQuery();
  const tasasActuales = tasasActualesData?.data?.tasas || [];

  const invalidateCache = useInvalidateContabilidadCache();

  // --- Helper Data Fetching for Metrics ---
  const { data: historyVentas } = useGetHistorialReconciliacionVentasQuery({ fechaInicio, fechaFin, cuentaId });
  const { data: ventasData } = useGetVentasPendientesQuery({ fechaFin, page, limit, fechaInicio });
  
  const { data: serviciosHistoryData } = useGetHistorialReconciliacionServiciosQuery({ fechaDesde: fechaInicio, fechaHasta: fechaFin, cuentaId });
  const { data: serviciosData } = useGetServiciosPendientesQuery({ fechaDesde: fechaInicio, fechaHasta: fechaFin, limit, page });

  const { data: gastosData } = useGetGastosPendientesQuery({ fechaDesde: fechaFin, fechaHasta: fechaFin, tipoGasto, periodo, soloNoReconciliados, page, limit });
  const { data: gastosHistoryData } = useGetHistorialReconciliacionGastosQuery({ fechaFin, fechaInicio, cuentaId, tipoGasto });

  // --- Calculations ---
  const ventasPend = ventasData?.ventas?.length || 0;
  const ventasCompleted = historyVentas?.reconciliaciones?.length || 0;

  const serviciosList = (serviciosData?.ventaServicios || []).filter((servicio) => {
    if (!servicio.reconciliaciones || servicio.reconciliaciones.length === 0) return true;
    const totalReconciliado = servicio.reconciliaciones.reduce((sum: number, rec: { montoConvertido?: number }) => sum + (rec.montoConvertido || 0), 0);
    return totalReconciliado < (servicio.total || 0);
  });
  const serviciosPend = serviciosList.length;
  const serviciosCompleted = serviciosHistoryData?.reconciliaciones?.length || 0;

  const gastosPend = gastosData?.gastos?.length || 0;
  const gastosCompleted = gastosHistoryData?.reconciliaciones?.length || 0;

  // --- Refresh Handler ---
  const handleRefresh = async (): Promise<void> => {
    try {
      setIsRefreshing(true);
      invalidateCache();
      await refetch();
      toast.success('Datos actualizados correctamente');
    } catch {
      toast.error('Error al actualizar los datos');
    } finally {
      setIsRefreshing(false);
    }
  };

  // --- Loading State ---
  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden border-slate-200/60  dark:border-slate-800/60 ">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-40" />
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                  <Skeleton className="h-3 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-full border-slate-200/60  dark:border-slate-800/60 ">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <div className="space-y-2 flex flex-col items-end">
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // --- Error State ---
  if (error) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900/50 dark:bg-rose-950/20"
      >
        <AlertCircle className="mx-auto h-10 w-10 text-rose-500 mb-3" />
        <h3 className="text-lg font-medium text-rose-900 dark:text-rose-200">Error al cargar datos</h3>
        <p className="text-sm text-rose-700 dark:text-rose-300 mb-4">
          No pudimos obtener el resumen financiero actualizado.
        </p>
        <Button onClick={() => refetch()} variant="outline" className="border-rose-300 hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-900/40">
          Intentar nuevamente
        </Button>
      </motion.div>
    );
  }

  if (!resumen) return null;

  // --- Data Processing ---
  const monedaPrincipal = (monedas as Moneda[]).find((m: Moneda) => m.esPrincipal)?.codigo || 'CUP';
  const tasasLookup: { [key: string]: number } = Array.isArray(tasasActuales)
    ? (tasasActuales as TasaCambio[]).reduce((acc: { [k: string]: number }, t) => {
        if (t && t.monedaOrigenId && t.monedaDestino) acc[`${t.monedaOrigenId}_${t.monedaDestino}`] = t.tasa;
        return acc;
      }, {})
    : {};

  const saldoNetoEnPrincipal = (resumen.cuentasBancarias || []).reduce((total, cuenta) => {
    const saldo = cuenta.saldo ?? 0;
    if (!cuenta.moneda || cuenta.moneda === monedaPrincipal) return total + saldo;
    
    const tasaActual = tasasActuales?.find(
      (t: TasaCambio) => t.monedaOrigenId === cuenta.moneda && t.monedaDestino === monedaPrincipal,
    )?.tasa;

    if (tasaActual) return total + saldo * tasaActual;
    
    // Fallback logic
    const directKey = `${cuenta.moneda}_${monedaPrincipal}`;
    const inverseKey = `${monedaPrincipal}_${cuenta.moneda}`;
    if (tasasLookup[directKey]) return total + saldo * tasasLookup[directKey];
    if (tasasLookup[inverseKey]) return total + saldo / tasasLookup[inverseKey];
    
    return total; // No conversion found
  }, 0);

  const resumenPrincipal = resumen.resumenPorMoneda?.find((m) => m.moneda === monedaPrincipal);
  const ingresosTotales = resumenPrincipal?.totalIngresos ?? 0;
  const egresosTotales = resumenPrincipal?.totalEgresos ?? 0;
  const saldoTone: AccentTone = saldoNetoEnPrincipal >= 0 ? 'emerald' : 'rose';

  const cards = [
    {
      title: "Ingresos Totales",
      subtitle: monedaPrincipal,
      value: ingresosTotales,
      icon: TrendingUp,
      tone: 'emerald' as AccentTone,
      description: "Entradas registradas en el período"
    },
    {
      title: "Egresos Totales",
      subtitle: monedaPrincipal,
      value: egresosTotales,
      icon: TrendingDown,
      tone: 'rose' as AccentTone,
      description: "Salidas y gastos registrados"
    },
    {
      title: "Saldo Neto Global",
      subtitle: "Consolidado",
      value: saldoNetoEnPrincipal,
      icon: Wallet,
      tone: saldoTone,
      description: "Balance total en moneda principal"
    },
  ];

  const reconciliationStats = [
    {
      label: "Ventas",
      pending: ventasPend,
      completed: ventasCompleted,
      icon: Receipt,
      tone: "blue" as AccentTone
    },
    {
      label: "Servicios",
      pending: serviciosPend,
      completed: serviciosCompleted,
      icon: CreditCard,
      tone: "violet" as AccentTone
    },
    {
      label: "Gastos",
      pending: gastosPend,
      completed: gastosCompleted,
      icon: Calculator,
      tone: "amber" as AccentTone
    }
  ];

  const periodoResumen = resumen.estadisticas?.periodo
    ? `${resumen.estadisticas.periodo.fechaInicio} - ${resumen.estadisticas.periodo.fechaFin}`
    : '';

  return (
    <motion.div
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Header Section */}
      <motion.section
        className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
        variants={itemVariants}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <Activity className="h-4 w-4" />
            <span className="uppercase tracking-wider text-xs">Resumen Financiero</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-300">
            Estado General
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl">
            Visión unificada del flujo de caja y estado de conciliaciones.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {periodoResumen && (
            <Badge variant="outline" className="h-9 px-3 gap-2 border-slate-200  dark:border-slate-800 ">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              {periodoResumen}
            </Badge>
          )}
          <CacheRefreshButton
            onRefresh={handleRefresh}
            isLoading={isRefreshing}
          />
        </div>
      </motion.section>

      {/* Main Metrics Cards */}
      <TooltipProvider>
        <motion.div className="grid gap-6 md:grid-cols-3" variants={containerVariants}>
          {cards.map((card) => {
            const Icon = card.icon;
            const style = toneStyles[card.tone];
            
            return (
              <motion.div
                key={card.title}
                variants={itemVariants}
                whileHover="hover"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card className={cn(
                      "relative overflow-hidden border-0 shadow-lg h-full cursor-help",
                      
                      "transition-all duration-300"
                    )}>
                      {/* Background Gradient */}
                      <div className={cn(
                        "absolute inset-0 bg-gradient-to-br opacity-100 dark:opacity-50",
                        style.gradient
                      )} />
                      
                      {/* Border Highlight */}
                      <div className={cn(
                        "absolute top-0 left-0 w-1 h-full",
                        card.tone === 'emerald' ? 'bg-emerald-500' : 
                        card.tone === 'rose' ? 'bg-rose-500' : 'bg-blue-500'
                      )} />

                      <CardContent className="p-6 relative z-10">
                        <div className="flex justify-between items-start mb-4">
                          <div className={cn("p-3 rounded-xl", style.icon)}>
                            <Icon className="h-6 w-6" />
                          </div>
                          {card.subtitle && (
                            <Badge variant="outline" className={cn("border-0", style.badge)}>
                              {card.subtitle}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            {card.title}
                          </p>
                          <div className={cn("text-3xl font-bold tracking-tight", style.text)}>
                            <AnimatedNumber value={card.value} prefix="$ " />
                          </div>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {card.description}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="max-w-xs">{card.description}</p>
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            );
          })}
        </motion.div>
      </TooltipProvider>

      {/* Secondary Metrics / Reconciliation Status */}
      <motion.section variants={itemVariants} className="grid gap-6 md:grid-cols-3">
        {reconciliationStats.map((stat) => {
          const Icon = stat.icon;
          const style = toneStyles[stat.tone];
          
          return (
            <motion.div key={stat.label} whileHover={{ scale: 1.02 }} className="h-full">
              <Card className="h-full border-slate-200/60 bg-white/60 dark:border-slate-800/60 dark:bg-slate-900/20 backdrop-blur-sm">
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn("p-2.5 rounded-lg", style.icon)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        {stat.label}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500">Pendientes:</span>
                        <Badge variant="secondary" className={cn("h-5 px-1.5 text-[10px]", style.badge)}>
                          <AnimatedNumber value={stat.pending} isInteger />
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                      <AnimatedNumber value={stat.completed} isInteger />
                    </div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Reconciliados</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.section>
    </motion.div>
  );
}
