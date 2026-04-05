'use client'

import { motion, AnimatePresence, useReducedMotion, Variants } from 'framer-motion'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const pathname = usePathname()
  const reducedMotion = useReducedMotion()

  const pageVariants: Variants = {
    initial: {
      opacity: 0,
      x: reducedMotion ? 0 : -20,
      scale: reducedMotion ? 1 : 0.95,
    },
    animate: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: {
        duration: reducedMotion ? 0.15 : 0.4,
        ease: [0.25, 0.46, 0.45, 0.94] as const,
      },
    },
    exit: {
      opacity: 0,
      x: reducedMotion ? 0 : 20,
      scale: reducedMotion ? 1 : 0.95,
      transition: {
        duration: reducedMotion ? 0.1 : 0.3,
        ease: [0.25, 0.46, 0.45, 0.94] as const,
      },
    },
  }

  const backgroundVariants: Variants = {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        duration: reducedMotion ? 0.15 : 1,
        ease: 'easeOut' as const,
      },
    },
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Animated Background Elements */}
      <motion.div
        variants={backgroundVariants}
        initial="initial"
        animate="animate"
        className="absolute inset-0 overflow-hidden pointer-events-none"
      >
        {/* Gradient Orbs */}
        <motion.div
          animate={reducedMotion ? {} : { y: [0, -20, 0] }}
          transition={reducedMotion ? {} : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-40 -left-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={reducedMotion ? {} : { y: [0, 20, 0] }}
          transition={reducedMotion ? {} : { duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute top-1/3 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={reducedMotion ? {} : { y: [0, -15, 0] }}
          transition={reducedMotion ? {} : { duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute -bottom-40 left-1/4 w-72 h-72 bg-blue-500/15 rounded-full blur-3xl"
        />
        
        {/* Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </motion.div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        {/* Back to home button */}
        <Link
          href="/"
          className="absolute top-4 left-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Volver al inicio
        </Link>

        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="w-full max-w-md"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
