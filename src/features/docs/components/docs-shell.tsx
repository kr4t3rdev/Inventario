"use client"

/**
 * @description Shell de la página de documentación.
 * Combina sidebar, búsqueda y contenido con una navegación superior hacia el inicio.
 * @param {{ currentSlug?: string; searchIndex: SearchIndexEntry[]; children: React.ReactNode }} props
 * @returns {JSX.Element} Layout completo de docs
 */
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Home, Menu } from "lucide-react"
import { motion } from "framer-motion"

import { Button } from "@/components/ui/button"

import { DocsSidebar } from "./docs-sidebar"
import { DocsSidebarMobile } from "./docs-sidebar-mobile"
import { DocsSearch } from "./docs-search"

import type { SearchIndexEntry } from "../data/types"

const SPRING_DEFAULT = { type: "spring" as const, stiffness: 140, damping: 18 }

/**
 * @description Deriva el slug actual de documentación a partir del pathname.
 * @param {string | null} pathname - Ruta actual del navegador.
 * @returns {string | undefined} Slug del módulo actual o undefined si es el índice general.
 */
function getCurrentSlugFromPathname(pathname: string | null): string | undefined {
  if (!pathname || pathname === "/docs") {
    return undefined
  }

  if (!pathname.startsWith("/docs/")) {
    return undefined
  }

  const slug = pathname.replace(/^\/docs\//, "").replace(/\/$/, "")
  return slug || undefined
}

export function DocsShell({
  searchIndex,
  children,
}: {
  searchIndex: SearchIndexEntry[]
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const currentSlug = getCurrentSlugFromPathname(pathname)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="relative mx-auto flex w-full max-w-7xl flex-1 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-12 right-[-6rem] h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:block">
        <DocsSidebar currentSlug={currentSlug} />
      </aside>

      {/* Mobile sidebar */}
      <DocsSidebarMobile
        currentSlug={currentSlug}
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Main content */}
      <main className="relative min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_DEFAULT}
          className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden shrink-0 rounded-full border border-border/50 bg-background/80 shadow-sm backdrop-blur"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menú de navegación"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <Button
              asChild
              variant="ghost"
              className="h-10 gap-2 rounded-full border border-border/50 bg-background/80 px-4 text-sm font-medium shadow-sm backdrop-blur transition-colors hover:bg-muted/60"
            >
              <Link href="/" aria-label="Volver al inicio">
                <Home className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Volver al inicio</span>
                <span className="sm:hidden">Inicio</span>
              </Link>
            </Button>
          </div>

          <div className="flex-1 sm:max-w-xl">
            <DocsSearch index={searchIndex} />
          </div>
        </motion.div>

        <motion.section
          key={pathname}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_DEFAULT, delay: 0.04 }}
        >
          {children}
        </motion.section>
      </main>
    </div>
  )
}
