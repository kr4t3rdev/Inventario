/**
 * @description Layout para las páginas de documentación pública.
 * Renderiza el shell con sidebar y búsqueda.
 * Es server component que genera el índice de búsqueda en build-time.
 */

import type { Metadata } from "next"
import { DocsShell } from "@/features/docs/components/docs-shell"
import { buildSearchIndex } from "@/features/docs/utils/search-index"

export const metadata: Metadata = {
  title: "Documentación — FinanceMDM",
  description: "Documentación completa del sistema FinanceMDM: módulos, funcionalidades y guías.",
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  // Build search index at build time
  const searchIndex = buildSearchIndex()

  return (
    <div className="min-h-screen bg-background">
      <DocsShell searchIndex={searchIndex}>{children}</DocsShell>
    </div>
  )
}
