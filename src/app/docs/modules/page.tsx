/**
 * @description Página pública que renderiza el mapa markdown de módulos.
 * Expone `content/docs/modules/INDEX.md` dentro de la UI web de documentación.
 */

import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { DocsContent } from "@/features/docs/components/docs-content"
import { buildCanonicalUrl, siteConfig } from "@/lib/seo/site"
import { readDocsModulesIndexContent } from "@/features/docs/utils/markdown"

export const metadata: Metadata = {
  title: `Mapa de módulos — Documentación ${siteConfig.name}`,
  description: "Mapa navegable de módulos y subguías de la documentación funcional.",
  alternates: {
    canonical: buildCanonicalUrl("/docs/modules"),
  },
}

export default function DocsModulesIndexPage() {
  const content = readDocsModulesIndexContent()

  if (!content) {
    notFound()
  }

  return (
    <div className="max-w-4xl">
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <span>Documentación</span>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-foreground">Mapa de módulos</span>
      </nav>

      <DocsContent content={content} />
    </div>
  )
}
