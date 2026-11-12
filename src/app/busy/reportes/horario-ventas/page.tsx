'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { m as motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Clock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ReportesShellLoader } from '@/features/reportes-financieros/components/reportes-shell-loader';
import { cn } from '@/lib/utils';
import { PageTransition } from '@/components/ui/animations';

const HorarioVentasPageLoader = () => <ReportesShellLoader kpis={3} />;

const ReporteHorarioVentas = dynamic(
  () =>
    import('@/features/reportes-financieros/components/horario-ventas/reporte-horario-ventas').then((mod) => ({
      default: mod.ReporteHorarioVentas,
    })),
  {
    loading: () => <HorarioVentasPageLoader />,
  },
);

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const surfaceCardClass = cn(
  'relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-900/10',
);
const statusBadgeClass = cn(
  'border border-blue-200/80 bg-blue-50/80 text-blue-700',
  'dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-300',
);

/**
 * @description Página de análisis del horario efectivo de ventas.
 * Muestra gráficos de barras por hora y heatmap semanal de las ventas.
 * @returns {JSX.Element} Vista animada del reporte de horario de ventas.
 */
export default function HorarioVentasPage() {
  const shouldReduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fadeInUp = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 18 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.42,
        ease: EASE_OUT,
      },
    },
  };

  if (!mounted) {
    return (
          <div className='space-y-8 p-8'>
            <HorarioVentasPageLoader />
          </div>
    );
  }

  return (
        <PageTransition className='space-y-8 p-8'>
          <div className='pointer-events-none absolute inset-0 -z-10 overflow-hidden'>
            <div className='absolute inset-0 bg-linear-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950/10 dark:via-slate-900/10 dark:to-slate-950/10' />
            <div className='absolute -top-24 right-[-8%] h-72 w-72 rounded-full bg-blue-500/10 blur-3xl' />
            <div className='absolute bottom-0 left-[-8%] h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl' />
          </div>

          <motion.div variants={fadeInUp} initial="hidden" animate="show">
            <Badge variant='outline'>Reporte analítico</Badge>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="show"
            className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'
          >
            <div className='space-y-1'>
              <div className='flex items-center gap-3'>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8 text-muted-foreground hover:text-foreground'
                  asChild
                >
                  <Link href='/busy/reportes' aria-label='Volver a reportes de inventario'>
                    <ArrowLeft className='h-4 w-4' aria-hidden='true' />
                  </Link>
                </Button>
                <div className='flex items-center gap-3'>
                  <div className='rounded-xl bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'>
                    <Clock className='h-5 w-5' />
                  </div>
                  <h1 className='bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-white dark:to-slate-300'>
                    Horario Efectivo de Ventas
                  </h1>
                </div>
              </div>
              <p className='pl-11 text-muted-foreground'>
                Distribución de ventas por hora del día y patrones semanales con vistas de barras y heatmap.
              </p>
            </div>

            <Badge className={statusBadgeClass}>
              Análisis horario
            </Badge>
          </motion.div>

          <motion.div variants={fadeInUp} initial="hidden" animate="show">
            <div className={surfaceCardClass}>
              <ReporteHorarioVentas />
            </div>
          </motion.div>
        </PageTransition>
  );
}
