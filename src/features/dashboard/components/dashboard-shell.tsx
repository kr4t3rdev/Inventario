'use client'

import type { ReactNode } from 'react'
import { motion, type Variants } from 'framer-motion'
import { LayoutDashboard, Sparkles, Activity } from 'lucide-react'

import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from '@/components/ui/animations'

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
}

const sparklesVariants: Variants = {
  animate: {
    rotate: 360,
    scale: [1, 1.2, 1],
    transition: {
      rotate: { duration: 18, repeat: Infinity, ease: 'linear' },
      scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
    },
  },
}

interface DashboardShellProps {
  children: ReactNode
}

/**
 * @description Shell del Dashboard con animaciones de fondo, header y layout.
 * Componente client que encapsula framer-motion y recibe children server/client.
 * @param {DashboardShellProps} props - Children widgets
 * @returns {JSX.Element} Layout animado del dashboard
 */
export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <PageTransition className="relative min-h-screen w-full">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <motion.div
          className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl dark:bg-blue-500/5 mix-blend-multiply dark:mix-blend-screen"
          animate={{ scale: [1, 1.1, 1], x: [0, 20, 0], y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl dark:bg-purple-500/5 mix-blend-multiply dark:mix-blend-screen"
          animate={{ scale: [1, 1.15, 1], x: [0, -30, 0], y: [0, 30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
        <motion.div
          className="absolute -bottom-8 left-1/3 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl dark:bg-emerald-500/5 mix-blend-multiply dark:mix-blend-screen"
          animate={{ scale: [1, 1.2, 1], x: [0, 25, 0], y: [0, 15, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
      </div>

      <StaggerContainer className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <StaggerItem className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 lg:px-6">
              <motion.div
                className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-blue-600 to-purple-600 shadow-lg"
                variants={headerIconVariants}
                initial="initial"
                whileHover="hover"
              >
                <LayoutDashboard className="h-6 w-6 text-white" />
                <motion.div
                  variants={sparklesVariants}
                  animate="animate"
                  className="absolute -right-1 -top-1"
                >
                  <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
                </motion.div>
                <motion.div
                  className="absolute inset-0 rounded-xl bg-gradient-to-tr from-transparent via-white/20 to-transparent"
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                  style={{ mixBlendMode: 'overlay' }}
                />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold bg-linear-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  Dashboard
                </h1>
                <p className="text-muted-foreground text-sm">
                  Resumen de tu negocio
                </p>
              </div>
              <motion.div
                className="ml-auto hidden sm:flex items-center gap-2"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
              >
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                  <motion.div
                    className="w-2 h-2 rounded-full bg-emerald-500"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  Sistema Activo
                </div>
              </motion.div>
            </div>

            {children}
          </StaggerItem>
        </div>
      </StaggerContainer>
    </PageTransition>
  )
}
