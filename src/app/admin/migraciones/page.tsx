'use client';

export const dynamic = 'force-dynamic';

import { LazyMotion, m as motion, type Variants } from 'framer-motion';
import { Sparkles, Shield, Info, Database, ArrowDownToLine } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MigrateCuentasPorPagarButton } from '@/features/admin/components/migrate-cuentas-por-pagar-button';
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
  AnimatedCard,
} from '@/components/ui/animations';

const headerIconVariants: Variants = {
  initial: { scale: 1, rotate: 0 },
  hover: {
    scale: 1.05,
    rotate: 5,
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 10,
    },
  },
};

const sparklesVariants: Variants = {
  animate: {
    rotate: 360,
    scale: [1, 1.2, 1],
    transition: {
      rotate: { duration: 18, repeat: Infinity, ease: 'linear' },
      scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
    },
  },
};

const titleVariants: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

/**
 * @description Página de herramientas de migración de datos en el Admin Panel.
 * @returns {JSX.Element} Panel de migración con herramientas técnicas.
 */
export default function MigratePage(): React.JSX.Element {
  return (
    <PageTransition className="relative min-h-screen w-full">
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <motion.div
          className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl dark:bg-violet-500/5"
          animate={{ scale: [1, 1.1, 1], x: [0, 20, 0], y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl dark:bg-purple-500/5"
          animate={{ scale: [1, 1.15, 1], x: [0, -30, 0], y: [0, 30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
      </div>

      <StaggerContainer className="flex flex-1 flex-col">
        <StaggerItem className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          {/* Header */}
          <motion.div
            className="flex items-center gap-3 px-4 lg:px-6"
            variants={titleVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div
              className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-purple-600 shadow-lg"
              variants={headerIconVariants}
              initial="initial"
              whileHover="hover"
            >
              <Database className="h-6 w-6 text-white" />
              <motion.div variants={sparklesVariants} animate="animate" className="absolute -right-1 -top-1">
                <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
              </motion.div>
              <motion.div
                className="absolute inset-0 rounded-xl bg-linear-to-tr from-transparent via-white/20 to-transparent"
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                style={{ mixBlendMode: 'overlay' }}
              />
            </motion.div>
            <div>
              <motion.h1
                className="text-2xl font-bold bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                Migración de Datos
              </motion.h1>
              <motion.p
                className="text-muted-foreground text-sm"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                Herramientas de administración para migrar datos antiguos
              </motion.p>
            </div>
          </motion.div>

          {/* Alert */}
          <motion.div
            className="px-4 lg:px-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <Alert className="border bg-card">
              <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle className="text-amber-700 dark:text-amber-300">Herramientas avanzadas</AlertTitle>
              <AlertDescription className="text-amber-600/80 dark:text-amber-400/80">
                Las migraciones modifican la base de datos.
                Asegurate de tener un backup antes de ejecutarlas.
              </AlertDescription>
            </Alert>
          </motion.div>

          {/* Content */}
          <motion.div
            className="grid gap-6 px-4 lg:px-6 max-w-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <AnimatedCard className="rounded-xl border bg-card shadow-sm">
              <MigrateCuentasPorPagarButton />
            </AnimatedCard>

            <AnimatedCard className="rounded-xl border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  Información sobre la migración
                </CardTitle>
                <CardDescription>
                  Lee cuidadosamente antes de ejecutar cualquier migración
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowDownToLine className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    <span className="font-medium text-foreground">¿Qué hace esta migración?</span>
                  </div>
                  <p>
                    Crea registros <code className="rounded bg-muted px-1.5 py-0.5 text-xs">GastoCompra</code> para las cuentas por pagar de compras antiguas
                    que fueron creadas antes de la actualización del sistema. Esto permite reconciliar
                    estas compras desde el módulo de Cuentas por Pagar.
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-medium text-foreground">¿Es seguro ejecutarla?</span>
                  </div>
                  <p>
                    Sí, la migración solo crea registros faltantes y no modifica datos existentes.
                    Sin embargo, se recomienda tener un backup de la base de datos antes de ejecutarla.
                  </p>
                </div>
              </CardContent>
            </AnimatedCard>
          </motion.div>
        </StaggerItem>
      </StaggerContainer>
    </PageTransition>
  );
}
