'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { LazyMotion, m as motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { canAccessAccountingItem } from '@/lib/plan-access';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * @description Loader para la página de ajustes bancarios.
 * @returns {JSX.Element} Skeleton de carga para el contenedor principal.
 */
function AjustesPageLoader() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-[30rem] max-w-full" />
      </div>
      <Skeleton className="h-[640px] w-full rounded-2xl" />
    </div>
  );
}

const AjustesBancariosPage = dynamic(
  () => import('@/features/contabilidad/components/ajustes-bancarios-page').then((mod) => ({ default: mod.AjustesBancariosPage })),
  {
    loading: () => <AjustesPageLoader />,
  }
);

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const statusBadgeClass = cn(
  'border border-amber-200/80 bg-amber-50/80 text-amber-700',
  'dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-300',
);
const surfaceCardClass = cn(
  'relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/75 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-900/10',
);

/**
 * @description Página principal para registrar y auditar ajustes bancarios.
 * @returns {JSX.Element} Vista de ajustes manuales de contabilidad.
 */
export default function AjustesPage() {
  const shouldReduceMotion = useReducedMotion();
  const router = useRouter();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isBlocked =
    user?.role !== 'admin' && !canAccessAccountingItem(user, 'Ajustes Bancarios');

  useEffect(() => {
    if (isBlocked) {
      router.replace('/busy/contabilidad');
    }
  }, [isBlocked, router]);

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

  if (isBlocked) return null;

  if (!mounted) {
    return (
          <div className="space-y-8 p-8">
            <AjustesPageLoader />
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
            <div className="absolute -top-24 right-[-8%] h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
            <div className="absolute bottom-0 left-[-8%] h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />
          </div>

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
                  <div className="rounded-xl bg-amber-100 p-2 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
                    <SlidersHorizontal className="h-5 w-5" />
                  </div>
                  <h1 className="bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-white dark:to-slate-300">
                    Ajustes Bancarios
                  </h1>
                </div>
              </div>
              <p className="pl-11 text-muted-foreground">
                Registre correcciones contables y mantenga trazabilidad completa de cada ajuste.
              </p>
            </div>

            <Badge className={statusBadgeClass}>
              Control manual habilitado
            </Badge>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <div className={surfaceCardClass}>
              <AjustesBancariosPage />
            </div>
          </motion.div>
        </motion.div>
  );
}
