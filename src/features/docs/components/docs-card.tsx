/**
 * @description Tarjeta de módulo para la página de índice.
 * @param {{ slug: string; title: string; description: string; domainIcon: string }} props
 * @returns {JSX.Element} Tarjeta clickeable
 */

import Link from "next/link"

interface DocsCardProps {
  slug: string
  title: string
  description: string
  domainIcon: string
}

export function DocsCard({ slug, title, description, domainIcon }: DocsCardProps) {
  return (
    <Link
      href={`/docs/${slug}`}
      className="group flex flex-col gap-1 rounded-lg border border-border/50 p-4 transition-all hover:border-primary/30 hover:bg-muted/30 hover:shadow-sm"
    >
      <h3 className="flex items-center gap-2 font-mono font-semibold text-sm">
        <span className="text-base" aria-hidden="true">
          {domainIcon}
        </span>
        {title}
      </h3>
      {description && (
        <p className="text-xs text-muted-foreground/80 leading-relaxed">{description}</p>
      )}
    </Link>
  )
}
