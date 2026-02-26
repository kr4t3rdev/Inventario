'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, CreditCard } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ReconciliacionServiciosPage } from '@/components/contabilidad/reconciliacion-servicios-page';
import { cn } from '@/lib/utils';

const sectionKickerClass = cn(
  'text-xs font-semibold uppercase tracking-[0.3em] text-slate-500',
  'dark:text-slate-400',
);

const metaBadgeClass = cn(
  'border border-slate-200/70 bg-white/80 text-slate-700 shadow-sm',
  'dark:border-slate-800/60 dark:bg-slate-900/10 dark:text-slate-200',
);

/**
 * @description Página de reconciliación de servicios con cabecera y contenido principal.
 * @returns {JSX.Element} Vista de reconciliación de servicios.
 */
export default function ServiciosReconciliacionPage(): React.JSX.Element {
  const shouldReduceMotion = useReducedMotion();

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
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 14 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.35,
        ease: 'easeOut' as const,
      },
    },
  };

  return (
    <motion.div className="relative overflow-hidden" variants={fadeIn} initial="hidden" animate="show">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-100',
            'dark:from-slate-950 dark:via-slate-900 dark:to-slate-950',
          )}
        />
        <div
          className={cn(
            'absolute -top-24 right-[-10%] h-72 w-72 rounded-full',
            'bg-gradient-to-br from-sky-400/25 via-blue-500/20 to-transparent',
            'blur-3xl dark:from-sky-400/20 dark:via-blue-500/25',
          )}
        />
      </div>

      <motion.div className="container mx-auto space-y-6 px-6 py-8" variants={fadeInUp}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
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
              <Link href="/busy/contabilidad/reconciliacion" className="flex items-center">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Link>
            </Button>
            <div className="space-y-1">
              <p className={sectionKickerClass}>Reconciliación</p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                Servicios
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Reconcilia servicios facturados con los pagos recibidos.
              </p>
            </div>
          </div>

          <Badge className={metaBadgeClass}>
            <CreditCard className="mr-2 h-3.5 w-3.5" />
            Módulo de servicios
          </Badge>
        </div>

        <ReconciliacionServiciosPage />
      </motion.div>
    </motion.div>
  );
}
