"use client"

import type React from "react"

/**
 * @description Encabezado principal de la página de documentación.
 * Presenta el propósito de la guía y ofrece acceso directo al inicio del producto.
 * @returns {React.JSX.Element} Hero de documentación
 */
import Link from "next/link"
import { ArrowRight, Home } from "lucide-react"
import { motion } from "framer-motion"

import { Button } from "@/components/ui/button"

const SPRING_DEFAULT = { type: "spring" as const, stiffness: 140, damping: 18 }

/**
 * @description Hero principal para el índice de documentación.
 * @returns {React.JSX.Element} Bloque introductorio con CTA hacia el inicio
 */
export function DocsIndexHero(): React.JSX.Element {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_DEFAULT}
      className="relative mb-10 overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-background via-background to-muted/35 p-6 shadow-sm md:p-8"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-10 top-0 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 top-8 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground/70 backdrop-blur">
            <span aria-hidden="true">📚</span>
            Guías para usuarios
          </div>

          <h1 className="max-w-xl font-mono text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Documentación clara para entender cada parte del sistema.
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
            Acá vas a encontrar explicaciones pensadas para operar el sistema sin perder tiempo: qué
            hace cada módulo, cuándo usarlo y cómo moverte con seguridad.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            asChild
            className="h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-transform hover:translate-y-[-1px]"
          >
            <Link href="/">
              <Home className="h-4 w-4" aria-hidden="true" />
              Volver al inicio
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="h-11 rounded-full border-border/60 bg-background/70 px-5 text-sm font-medium shadow-sm backdrop-blur"
          >
            <Link href="#catalogo">
              Ver módulos
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </motion.section>
  )
}
