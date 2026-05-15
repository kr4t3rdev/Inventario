'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, useReducedMotion } from 'framer-motion';
import { Settings, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

// Dynamic imports with skeleton loaders
const TiposPagoConfigPage = dynamic(
  () => import('@/features/contabilidad/components/tipos-pago-config-page').then((mod) => ({ default: mod.TiposPagoConfigPage })),
  {
    loading: () => (
      <div className="w-full space-y-4 rounded-xl border border-slate-200/60 bg-white/40 p-6 backdrop-blur-sm dark:border-slate-800/60 dark:bg-slate-950/40">
        <div className="h-8 w-1/3 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
        <div className="space-y-3 pt-4">
          <div className="h-24 w-full animate-pulse rounded-lg bg-slate-200/60 dark:bg-slate-800/60" />
          <div className="h-24 w-full animate-pulse rounded-lg bg-slate-200/60 dark:bg-slate-800/60" />
        </div>
      </div>
    ),
    ssr: false,
  },
);

const surfaceCardClass = cn(
  'relative overflow-hidden border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl',
  'dark:border-slate-800/60 dark:bg-slate-900/10',
);

const outlineButtonClass = cn(
  'border-slate-200/70 bg-white/80 text-slate-700 shadow-sm transition-all duration-300',
  'hover:bg-white hover:border-blue-500/40 hover:text-blue-600',
  'dark:border-slate-800/60 dark:bg-slate-950/60 dark:text-slate-200',
  'dark:hover:bg-slate-950 dark:hover:border-blue-400/40 dark:hover:text-blue-400',
);

/**
 * @description Página de configuración contable y de tipos de pago.
 * @returns {JSX.Element} Vista de configuración.
 */
export default function ConfiguracionPage(): React.JSX.Element {
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
        ease: 'easeOut' as const,
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
        ease: 'easeOut' as const,
      },
    },
  };

  if (!mounted) return <div className="min-h-screen bg-background" />;

  return (
    <SidebarProvider>
      <SidebarInset className="bg-background">
        <motion.div 
          className="container mx-auto py-6 px-4 space-y-8" 
          variants={fadeIn} 
          initial="hidden" 
          animate="show"
        >
          {/* Header Section */}
          <motion.div variants={fadeInUp} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 w-8 rounded-full p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                  asChild
                >
                  <Link href="/busy/contabilidad">
                    <ArrowLeft className="h-5 w-5" />
                    <span className="sr-only">Volver</span>
                  </Link>
                </Button>
                <h1 className="text-3xl font-bold tracking-tight bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent dark:from-white dark:to-slate-300">
                  Configuración Contable
                </h1>
              </div>
              <p className="max-w-2xl text-lg text-muted-foreground">
                Administra los tipos de pago, monedas y parámetros generales del sistema contable.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium",
                "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10",
                "dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/20"
              )}>
                <Settings className="h-4 w-4" />
                <span>Sistema Activo</span>
              </div>
            </div>
          </motion.div>

          {/* Main Content */}
          <motion.div variants={fadeInUp}>
             <TiposPagoConfigPage />
          </motion.div>
        </motion.div>
      </SidebarInset>
    </SidebarProvider>
  );
}
