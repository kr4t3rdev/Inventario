/**
 * @description Página de índice de documentación.
 * Muestra los 9 dominios con sus módulos en tarjetas.
 * SSG — se genera completamente en build-time.
 */

import type { Metadata } from "next"
import { DOC_DOMAINS } from "@/features/docs/data/domains"
import { DomainGroup } from "@/features/docs/components/domain-group"

export const metadata: Metadata = {
  title: "Documentación — FinanceMDM",
  description: "Guía completa de todos los módulos del sistema FinanceMDM.",
}

export default function DocsIndexPage() {
  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-mono text-2xl font-bold tracking-tight mb-2">
          Documentación del Sistema
        </h1>
        <p className="text-sm text-muted-foreground">
          FinanceMDM — Sistema de Gestión de Inventario, Ventas, Finanzas y Contabilidad
        </p>
      </div>

      {/* Domain groups */}
      <div className="flex flex-col gap-8">
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
