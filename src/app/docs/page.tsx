/**
 * @description Página de índice de documentación.
 * Muestra los 9 dominios con sus módulos en tarjetas.
 * SSG — se genera completamente en build-time.
 */

import type { Metadata } from "next"
import { DOC_DOMAINS } from "@/features/docs/data/domains"
import { DomainGroup } from "@/features/docs/components/domain-group"
import { DocsIndexHero } from "@/features/docs/components/docs-index-hero"

export const metadata: Metadata = {
  title: "Documentación — FinanceMDM",
  description: "Guía completa de todos los módulos del sistema FinanceMDM.",
}

export default function DocsIndexPage() {
  return (
    <div className="max-w-6xl">
      <DocsIndexHero />

      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground/60">
          FinanceMDM
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Sistema de Gestión de Inventario, Ventas, Finanzas y Contabilidad.
        </p>
      </div>

      {/* Domain groups */}
      <div id="catalogo" className="flex flex-col gap-10">
        {DOC_DOMAINS.map((domain) => (
          <DomainGroup
            key={domain.name}
            name={domain.name}
            icon={domain.icon}
            modules={domain.modules}
          />
        ))}
      </div>
    </div>
  )
}
