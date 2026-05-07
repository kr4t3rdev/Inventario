'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, CalendarDays, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { PageTransition } from '@/components/ui/animations';

/**
 * @description Loader de precarga para venta diaria.
 * @returns {JSX.Element} Skeleton de la página mientras carga el módulo.
 */
function VentaDiariaPageLoader() {
  return (
    <div className='space-y-6'>
      <div className='space-y-2'>
        <Skeleton className='h-5 w-40' />
        <Skeleton className='h-8 w-80' />
        <Skeleton className='h-4 w-[34rem] max-w-full' />
      </div>
      <div className='grid gap-4 md:grid-cols-4'>
        <Skeleton className='h-24 rounded-xl' />
        <Skeleton className='h-24 rounded-xl' />
        <Skeleton className='h-24 rounded-xl' />
        <Skeleton className='h-24 rounded-xl' />
      </div>
      <Skeleton className='h-[620px] w-full rounded-2xl' />
    </div>
  );
}

const ReporteVentaDiaria = dynamic(
  () =>
    import('@/features/reportes-financieros/components/reporte-venta-diaria').then((mod) => ({
      default: mod.ReporteVentaDiaria,
    })),
  {
    loading: () => <VentaDiariaPageLoader />,
  },
);

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const surfaceCardClass = cn(
  'relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-900/10',
);
const statusBadgeClass = cn(
  'border border-emerald-200/80 bg-emerald-50/80 text-emerald-700',
  'dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300',
);

/**
 * @description Página de análisis de venta diaria.
 * @returns {JSX.Element} Vista animada para consulta diaria de ventas.
 */
export default function VentaDiariaPage() {
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
      <SidebarProvider>
        <SidebarInset className='bg-background'>
          <div className='space-y-8 p-8'>
            <VentaDiariaPageLoader />
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <SidebarInset className='bg-background'>
        <PageTransition className='space-y-8 p-8'>
          <div className='pointer-events-none absolute inset-0 -z-10 overflow-hidden'>
            <div className='absolute inset-0 bg-linear-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950/10 dark:via-slate-900/10 dark:to-slate-950/10' />
            <div className='absolute -top-24 right-[-8%] h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl' />
            <div className='absolute bottom-0 left-[-8%] h-72 w-72 rounded-full bg-blue-500/10 blur-3xl' />
          </div>

          <motion.div variants={fadeInUp} initial="hidden" animate="show">
            <Badge variant='outline'>Reporte operativo</Badge>
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
                  <Link href='/busy/reportes'>
                    <ArrowLeft className='h-4 w-4' />
                  </Link>
                </Button>
                <div className='flex items-center gap-3'>
                  <div className='rounded-xl bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300'>
                    <CalendarDays className='h-5 w-5' />
                  </div>
                  <h1 className='bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-white dark:to-slate-300'>
                    Venta Diaria
                  </h1>
                </div>
              </div>
              <p className='pl-11 text-muted-foreground'>
                Seguimiento de ingresos, tendencias y transacciones del día con filtros rápidos.
              </p>
            </div>

            <Badge className={statusBadgeClass}>
              <Sparkles className='mr-1 h-3.5 w-3.5' />
              Monitoreo continuo
            </Badge>
          </motion.div>

          <motion.div variants={fadeInUp} initial="hidden" animate="show">
            <div className={surfaceCardClass}>
              <ReporteVentaDiaria />
            </div>
          </motion.div>
        </PageTransition>
      </SidebarInset>
    </SidebarProvider>
  );
}
