'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { LazyMotion, m as motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
;
import { Skeleton } from '@/components/ui/skeleton';
import { ContabilidadBreadcrumb } from '@/features/contabilidad/components/contabilidad-breadcrumb';
import { cn } from '@/lib/utils';

/**
 * @description Loader para precargar la vista de auditoría.
 * @returns {JSX.Element} Skeleton principal de logs.
 */
function LogsPageLoader() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-[30rem] max-w-full" />
      </div>
      <Skeleton className="h-[580px] w-full rounded-2xl" />
    </div>
  );
}

const AuditLogsTable = dynamic(
  () => import('@/features/contabilidad/components/audit-logs-table').then((mod) => ({ default: mod.AuditLogsTable })),
  {
    loading: () => <LogsPageLoader />,
  }
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
 * @description Página de auditoría para revisar eventos del módulo contable.
 * @returns {JSX.Element} Vista de logs de auditoría.
 */
export default function LogsPage() {
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
        duration: shouldReduceMotion ? 0 : 0.5,
        ease: EASE_OUT
      },
    },
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.5,
        ease: EASE_OUT
      },
    },
  };

  if (!mounted) {
    return (
          <div className="space-y-8 p-8">
            <LogsPageLoader />
          </div>
    );
  }

  return (
        <motion.div
          className="space-y-8 p-8"
          variants={fadeIn}
          initial="hidden"
          animate="show"
        >
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute inset-0 bg-linear-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
            <div className="absolute -top-24 right-[-8%] h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="absolute bottom-0 left-[-8%] h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
          </div>

          <motion.div variants={fadeInUp}>
            <ContabilidadBreadcrumb />
          </motion.div>

          <motion.div variants={fadeInUp} className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  asChild
                >
                  <Link href="/busy/contabilidad">
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <h1 className="bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-white dark:to-slate-300">
                    Auditoría del Sistema
                  </h1>
                </div>
              </div>
              <p className="pl-11 text-muted-foreground">
                Visualice, filtre y trace operaciones críticas del módulo de contabilidad.
              </p>
            </div>

            <Badge className={statusBadgeClass}>
              <ShieldAlert className="mr-1 h-3.5 w-3.5" />
              Seguridad activa
            </Badge>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <div className={surfaceCardClass}>
              <AuditLogsTable />
            </div>
          </motion.div>
        </motion.div>
  );
}
