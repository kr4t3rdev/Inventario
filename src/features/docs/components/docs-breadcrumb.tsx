/**
 * @description Breadcrumb de navegación para la página de un módulo.
 * @param {{ domain: string; moduleTitle: string }} props
 * @returns {JSX.Element | null} Breadcrumb o null si falta data
 */

import Link from "next/link"
import { ChevronRight } from "lucide-react"

export function DocsBreadcrumb({
  domain,
  moduleTitle,
}: {
  domain?: string
  moduleTitle?: string
}) {
  if (!domain || !moduleTitle) return null

  return (
    <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
      <Link href="/docs" className="hover:text-foreground transition-colors">
        Documentación
      </Link>
      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="text-foreground/60">{domain}</span>
      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="font-medium text-foreground" aria-current="page">
        {moduleTitle}
      </span>
    </nav>
  )
}
