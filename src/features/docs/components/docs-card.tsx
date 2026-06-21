"use client"

/**
 * @description Tarjeta de módulo para la página de índice con hover suave y entrada escalonada.
 * @param {{ slug: string; title: string; description: string; domainIcon: string; index?: number }} props
 * @returns {JSX.Element} Tarjeta clickeable
 */
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { motion } from "framer-motion"

interface DocsCardProps {
  slug: string
  title: string
  description: string
  domainIcon: string
  index?: number
}

export function DocsCard({ slug, title, description, domainIcon, index = 0 }: DocsCardProps) {
  return (
    <Link href={`/docs/${slug}`} className="block h-full">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          type: "spring",
          stiffness: 180,
          damping: 18,
          delay: index * 0.03,
        }}
        whileHover={{ y: -4, scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-background via-background to-muted/20 p-5 shadow-sm transition-shadow hover:border-primary/30 hover:shadow-lg"
      >
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="flex items-start justify-between gap-3">
          <h3 className="flex items-center gap-2 font-mono text-sm font-semibold tracking-tight">
            <span className="text-base" aria-hidden="true">
              {domainIcon}
            </span>
            {title}
          </h3>
          <span className="rounded-full border border-border/60 bg-background/80 p-1 text-muted-foreground transition-colors group-hover:text-foreground">
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
        {description && (
          <p className="text-xs leading-relaxed text-muted-foreground/80">{description}</p>
        )}
        <div className="mt-auto flex items-center gap-2 text-xs font-medium text-primary">
          <span>Ver guía</span>
          <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
      </motion.div>
    </Link>
  )
}
