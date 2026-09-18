/**
 * @description Grupo de dominio con sección y tarjetas de módulos.
 * @param {{ name: string; icon: string; modules: Array<{ slug: string; title: string; description: string }> }} props
 * @returns {JSX.Element} Sección de dominio
 */

import { DocsCard } from "./docs-card"

interface DomainGroupProps {
  name: string
  icon: string
  modules: Array<{
    slug: string
    title: string
    description: string
  }>
}

export function DomainGroup({ name, icon, modules }: DomainGroupProps) {
  if (modules.length === 0) return null

  return (
    <section className="scroll-mt-24">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground/60">
            Sección
          </p>
          <h2 className="flex items-center gap-2 font-mono text-lg font-bold tracking-tight">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 bg-background/80 text-base shadow-sm"
            >
              {icon}
            </span>
            {name}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod, index) => (
          <DocsCard
            key={mod.slug}
            slug={mod.slug}
            title={mod.title}
            description={mod.description}
            domainIcon={icon}
            index={index}
          />
        ))}
      </div>
    </section>
  )
}
