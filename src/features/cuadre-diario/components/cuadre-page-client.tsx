'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, BriefcaseBusiness, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * @description Skeleton para la carga inicial del cuadre financiero.
 * @returns {JSX.Element} Estructura de precarga.
 */
function CuadrePageLoader() {
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

const CuadreDiarioFinanciero = dynamic(
  () =>
    import('@/features/cuadre-diario/components/cuadre-diario').then((mod) => ({
      default: mod.CuadreDiarioFinanciero,
    })),
  {
    loading: () => <CuadrePageLoader />,
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
 * @description Shell visual del módulo de cuadre diario financiero.
 * @returns {JSX.Element} Página con transiciones, estado y contenido principal.
 */
export function CuadrePageClient() {
  const shouldReduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fadeIn = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.45,
        ease: EASE_OUT,
      },
    },
  };

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

  const stagger = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.08,
      },
    },
  };

  if (!mounted) {
    return (
      <SidebarProvider>
        <SidebarInset className='bg-background'>
          <div className='space-y-8 p-8'>
            <CuadrePageLoader />
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <SidebarInset className='bg-background'>
        <motion.div className='space-y-8 p-8' variants={fadeIn} initial='hidden' animate='show'>
          <div className='pointer-events-none absolute inset-0 -z-10 overflow-hidden'>
            <div className='absolute inset-0 bg-linear-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950' />
            <div className='absolute -top-24 right-[-10%] h-72 w-72 rounded-full bg-blue-500/10 blur-3xl' />
          </div>

          <motion.div variants={fadeInUp}>
            <Badge variant='outline'>Reporte financiero diario</Badge>
          </motion.div>

          <motion.div
            variants={fadeInUp}
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
                  <div className='rounded-xl bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'>
                    <BriefcaseBusiness className='h-5 w-5' />
                  </div>
                  <h1 className='bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-white dark:to-slate-300'>
                    Cuadre Diario Financiero
                  </h1>
                </div>
              </div>
              <p className='pl-11 text-muted-foreground'>
                Revise ingresos, salidas y conciliación por métodos de pago en un solo flujo.
              </p>
            </div>

            <Badge className={statusBadgeClass}>
              <Sparkles className='mr-1 h-3.5 w-3.5' />
              Resumen listo para auditoría
            </Badge>
          </motion.div>

          <motion.div variants={stagger} className='grid gap-3 md:grid-cols-3'>
            <motion.div variants={fadeInUp}>
              <Badge variant='outline' className='h-9 px-3'>
                Ventas y servicios del día
              </Badge>
            </motion.div>
            <motion.div variants={fadeInUp}>
              <Badge variant='outline' className='h-9 px-3'>
                Flujo de caja con entradas/salidas
              </Badge>
            </motion.div>
            <motion.div variants={fadeInUp}>
              <Badge variant='outline' className='h-9 px-3'>
                Totales por método de pago
              </Badge>
            </motion.div>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <div className={surfaceCardClass}>
              <CuadreDiarioFinanciero />
            </div>
          </motion.div>
        </motion.div>
      </SidebarInset>
    </SidebarProvider>
  );
}
