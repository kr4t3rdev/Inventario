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
    <section>
      <h2 className="flex items-center gap-2 font-mono text-lg font-bold mb-3">
        <span aria-hidden="true">{icon}</span>
        {name}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => (
          <DocsCard
            key={mod.slug}
            slug={mod.slug}
            title={mod.title}
            description={mod.description}
            domainIcon={icon}
          />
        ))}
      </div>
    </section>
  )
}
