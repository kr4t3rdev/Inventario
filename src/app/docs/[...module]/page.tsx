/**
 * @description Página de detalle de un módulo de documentación.
 * Catch-all route que maneja slugs planos (/docs/productos) y anidados (/docs/contabilidad/periodos-contables).
 * SSG — se genera completamente en build-time.
 */

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { JsonLd } from '@/components/seo/json-ld'
import { DocsContent } from "@/features/docs/components/docs-content"
import { DocsBreadcrumb } from "@/features/docs/components/docs-breadcrumb"
import { buildAllSlugs } from "@/features/docs/utils/registry"
import { readModuleContent } from "@/features/docs/utils/markdown"
import { getModuleBySlug } from "@/features/docs/data/domains"
import {
  buildDocsBreadcrumbSchema,
  buildDocsModuleMetadata,
  getDocsModulePresentation,
} from '@/features/docs/utils/module-meta'

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

  return buildDocsModuleMetadata(slug)
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

  const breadcrumbSchema = buildDocsBreadcrumbSchema(slug)
  const presentation = getDocsModulePresentation(slug)

  return (
    <div className="max-w-4xl">
      {breadcrumbSchema ? <JsonLd data={breadcrumbSchema} /> : null}
      <DocsBreadcrumb domain={mod.domain} moduleTitle={mod.title} />
      <DocsContent content={content} lastUpdatedLabel={presentation.lastUpdatedLabel} />
    </div>
  )
}
