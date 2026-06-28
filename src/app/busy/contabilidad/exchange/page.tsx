'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { m as motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { shouldHideBasicAccountingItem } from '@/lib/plan-access';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * @description Indicador de precarga para la página de exchange.
 * @returns {JSX.Element} Skeleton de la vista mientras carga el contenido.
 */
function ExchangePageLoader() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-[28rem] max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-[520px] w-full rounded-2xl" />
    </div>
  );
}

const ExchangeManager = dynamic(
  () => import('@/features/contabilidad/components/exchange-manager').then((mod) => ({ default: mod.ExchangeManager })),
  {
    loading: () => <ExchangePageLoader />,
  }
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
 * @description Página para gestión de monedas, tasas de cambio y conversiones.
 * @returns {JSX.Element} Vista principal de exchange.
 */
export default function ExchangePage() {
  const shouldReduceMotion = useReducedMotion();
  const router = useRouter();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isBlocked = user?.role !== 'admin' && (shouldHideBasicAccountingItem(user, 'Exchange') || user?.planFeatures?.['multi-moneda'] !== true);

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
        duration: shouldReduceMotion ? 0 : 0.45,
        ease: EASE_OUT
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

  if (isBlocked) return null;

  if (!mounted) {
    return (
          <div className="space-y-8 p-8">
            <ExchangePageLoader />
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
            <div className="absolute -top-24 right-[-8%] h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="absolute bottom-0 left-[-8%] h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
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
                  <div className="rounded-xl bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                    <Coins className="h-5 w-5" />
                  </div>
                  <h1 className="bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-white dark:to-slate-300">
                    Exchange y Monedas
                  </h1>
                </div>
              </div>
              <p className="pl-11 text-muted-foreground">
                Gestione tasas de cambio, conversiones y monedas operativas con trazabilidad.
              </p>
            </div>

            <Badge className={statusBadgeClass}>
              Módulo en tiempo real
            </Badge>
          </motion.div>

          <motion.div variants={stagger} className="grid gap-4 md:grid-cols-3">
            <motion.div variants={fadeInUp}>
              <Badge variant="outline" className="h-9 px-3">
                Tasas vigentes centralizadas
              </Badge>
            </motion.div>
            <motion.div variants={fadeInUp}>
              <Badge variant="outline" className="h-9 px-3">
                Conversión con histórico de cambios
              </Badge>
            </motion.div>
            <motion.div variants={fadeInUp}>
              <Badge variant="outline" className="h-9 px-3">
                Configuración multi-moneda
              </Badge>
            </motion.div>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <div className={surfaceCardClass}>
              <ExchangeManager />
            </div>
          </motion.div>
        </motion.div>
  );
}
