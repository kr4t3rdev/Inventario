/**
 * @description Página de detalle de un módulo de documentación.
 * Catch-all route que maneja slugs planos (/docs/productos) y anidados (/docs/contabilidad/periodos-contables).
 * SSG — se genera completamente en build-time.
 */

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { DocsContent } from "@/features/docs/components/docs-content"
import { DocsBreadcrumb } from "@/features/docs/components/docs-breadcrumb"
import { buildAllSlugs } from "@/features/docs/utils/registry"
import { readModuleContent } from "@/features/docs/utils/markdown"
import { getModuleBySlug } from "@/features/docs/data/domains"

interface Props {
  params: Promise<{ module: string[] }>
}

/**
 * @description Genera los slugs estáticos en build-time.
 * Incluye módulos planos y sub-páginas de contabilidad.
 */
export async function generateStaticParams(): Promise<{ module: string[] }[]> {
  const slugs = buildAllSlugs()

  return slugs.map((slug) => ({
    module: slug.split("/"),
  }))
}

/**
 * @description Genera los metadatos para cada página de módulo.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { module } = await params
  const slug = module.join("/")
  const mod = getModuleBySlug(slug)

  if (!mod) {
    return { title: "Módulo no encontrado — FinanceMDM" }
  }

  return {
    title: `${mod.title} — Documentación FinanceMDM`,
    description: mod.description,
  }
}

/**
 * @description Página de detalle de un módulo.
 * Lee el markdown en build-time y lo pasa al componente cliente para renderizar.
 */
export default async function DocsModulePage({ params }: Props) {
  const { module } = await params
  const slug = module.join("/")

  const mod = getModuleBySlug(slug)
  if (!mod) {
    notFound()
  }

  const content = readModuleContent(slug)
  if (!content) {
    notFound()
  }

  return (
    <div className="max-w-4xl">
      <DocsBreadcrumb domain={mod.domain} moduleTitle={mod.title} />
      <DocsContent content={content} />
    </div>
  )
}
