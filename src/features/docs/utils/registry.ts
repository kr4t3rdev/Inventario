/**
 * @description Construye el registro de módulos en build-time.
 * Solo se ejecuta en el servidor durante la compilación (SSG).
 */

import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { getModuleBySlug } from "../data/domains"

const DOCS_MODULES_DIR = join(process.cwd(), "docs/modules")

/** Módulos contables que existen como sub-páginas dentro de contabilidad/ */
const CONTABILIDAD_SUB_PAGES = ["periodos-contables", "reconciliacion", "ajustes-bancarios"] as const

/**
 * @description Escanea docs/modules/ en build-time y devuelve todos los slugs disponibles.
 * Incluye módulos planos (directorios) y sub-páginas de contabilidad.
 */
export function buildAllSlugs(): string[] {
  const slugs: string[] = []

  let entries: string[]
  try {
    entries = readdirSync(DOCS_MODULES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } catch {
    return slugs
  }

  for (const entry of entries) {
    // Skip template
    if (entry === "TEMPLATE.md" || entry.startsWith(".")) continue

    const slug = entry
    const modInfo = getModuleBySlug(slug)

    if (modInfo) {
      slugs.push(slug)
    }

    // Sub-páginas de contabilidad
    if (entry === "contabilidad") {
      for (const sub of CONTABILIDAD_SUB_PAGES) {
        const subSlug = `contabilidad/${sub}`
        const subInfo = getModuleBySlug(subSlug)
        if (subInfo) {
          slugs.push(subSlug)
        }
      }
    }
  }

  return slugs
}

/**
 * @description Extrae el título de un markdown (primera línea # Heading).
 */
export function extractTitle(markdownContent: string): string {
  const match = markdownContent.match(/^#\s+(.+)/m)
  return match?.[1] ?? ""
}

/**
 * @description Extrae la descripción de un markdown (primer párrafo después del título).
 */
export function extractDescription(markdownContent: string, maxLen = 200): string {
  // Skip the title line
  const withoutTitle = markdownContent.replace(/^#\s+.+(\r?\n|$)/, "")

  // Skip blockquote lines (like > **Feature**: ...)
  const clean = withoutTitle.replace(/^>.*$/gm, "").trim()

  // Get first paragraph
  const firstPara = clean.match(/^(.+?)(\n\n|$)/s)
  const desc = firstPara?.[1]?.trim() ?? ""

  return desc.length > maxLen ? desc.slice(0, maxLen) + "..." : desc
}
