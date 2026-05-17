"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { LazyMotion, m as motion, useReducedMotion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SubPageShellProps {
  title: string
  description: string
  icon: ReactNode
  children: ReactNode
}

const sectionKickerClass = cn("text-xs font-semibold uppercase tracking-[0.3em] text-slate-500", "dark:text-slate-400")
const metaBadgeClass = cn("border border-slate-200/70 bg-white/80 text-slate-700 shadow-sm", "dark:border-slate-800/60 dark:bg-slate-950/60 dark:text-slate-200")

/**
 * @description Shell compartido para las sub-páginas de reconciliación.
 * Server-rendered header with client animations.
 */
export function ReconciliacionSubPageShell({ title, description, icon, children }: SubPageShellProps) {
  const shouldReduceMotion = useReducedMotion()
  const fadeIn = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: shouldReduceMotion ? 0 : 0.3, ease: "easeOut" as const } } }
  const fadeInUp = { hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 14 }, show: { opacity: 1, y: 0, transition: { duration: shouldReduceMotion ? 0 : 0.35, ease: "easeOut" as const } } }

  return (
    <motion.div initial="hidden" animate="show" variants={fadeIn} className="space-y-6 p-8">
      <motion.div variants={fadeInUp} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link href="/busy/contabilidad/reconciliacion"><ArrowLeft className="mr-1 h-4 w-4" />Volver</Link>
          </Button>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
            <div>
              <p className={sectionKickerClass}>Reconciliación</p>
              <h1 className="text-xl font-semibold">{title}</h1>
            </div>
          </div>
        </div>
        <Badge className={metaBadgeClass}>{description}</Badge>
      </motion.div>
      {children}
    </motion.div>
  )
}
