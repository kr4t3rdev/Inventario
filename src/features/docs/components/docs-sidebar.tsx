/**
 * @description Sidebar de navegación para el sitio de documentación.
 * Muestra los módulos agrupados por dominio.
 * @param {{ currentSlug?: string }} props
 * @returns {JSX.Element} Sidebar de escritorio
 */

import Link from "next/link"
import { DOC_DOMAINS } from "../data/domains"

export function DocsSidebar({ currentSlug }: { currentSlug?: string }) {
  return (
    <nav className="w-64 shrink-0 overflow-y-auto border-r border-border/50 py-6 pr-4" aria-label="Módulos">
      <div className="mb-4 px-3">
        <Link
          href="/docs"
          className={`block rounded-md px-3 py-2 text-sm font-mono transition-colors ${
            !currentSlug
              ? "bg-primary/10 font-semibold text-primary"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          Índice General
        </Link>
        <Link
          href="/docs/modules"
          className="mt-1 block rounded-md px-3 py-2 text-sm font-mono text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          Mapa de módulos
        </Link>
      </div>

      {DOC_DOMAINS.map((domain) => (
        <div key={domain.name} className="mb-4">
          <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            {domain.icon} {domain.name}
          </h3>
          <ul className="mt-1 space-y-0.5">
            {domain.modules.map((mod) => {
              const isActive = currentSlug === mod.slug
              const domainSlug = mod.slug
              return (
                <li key={mod.slug}>
                  <Link
                    href={`/docs/${domainSlug}`}
                    className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                      isActive
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {mod.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
