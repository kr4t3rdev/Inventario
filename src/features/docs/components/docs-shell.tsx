/**
 * @description Shell de la página de documentación.
 * Combina sidebar, búsqueda y contenido.
 * @param {{ currentSlug?: string; searchIndex: SearchIndexEntry[]; children: React.ReactNode }} props
 * @returns {JSX.Element} Layout completo de docs
 */
"use client"

import { useState } from "react"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"

import { DocsSidebar } from "./docs-sidebar"
import { DocsSidebarMobile } from "./docs-sidebar-mobile"
import { DocsSearch } from "./docs-search"

import type { SearchIndexEntry } from "../data/types"

export function DocsShell({
  currentSlug,
  searchIndex,
  children,
}: {
  currentSlug?: string
  searchIndex: SearchIndexEntry[]
  children: React.ReactNode
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1">
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
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        {/* Header bar with hamburger + search (always visible) */}
        <div className="mb-6 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menú de navegación"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <DocsSearch index={searchIndex} />
          </div>
        </div>

        {children}
      </main>
    </div>
  )
}
