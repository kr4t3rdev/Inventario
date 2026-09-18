/**
 * @description Construye el índice de búsqueda en build-time.
 * Genera un JSON con todos los módulos indexados para Fuse.js.
 */

import type { SearchIndexEntry } from "../data/types"
import { getAllModules } from "../data/domains"
import { readModuleContent } from "./markdown"
import { extractTitle, extractDescription } from "./registry"

/**
 * @description Genera el índice de búsqueda completo para Fuse.js.
 * Se ejecuta en build-time.
 */
export function buildSearchIndex(): SearchIndexEntry[] {
  const modules = getAllModules()
  const index: SearchIndexEntry[] = []

  for (const mod of modules) {
    const content = readModuleContent(mod.slug)
    if (!content) continue

    const title = extractTitle(content) || mod.title
    const description = extractDescription(content) || mod.description

    // Remove frontmatter, HTML tags, and normalize whitespace for search
    const cleanContent = content
      .replace(/^---[\s\S]*?---/m, "") // Remove YAML frontmatter
      .replace(/<[^>]*>/g, "") // Remove HTML tags
      .replace(/```[\s\S]*?```/g, "") // Remove code blocks
      .replace(/\n{3,}/g, "\n") // Normalize whitespace
      .trim()

    index.push({
      slug: mod.slug,
      title,
      domain: mod.domain,
      description,
      content: cleanContent.slice(0, 5000), // Limit content size per entry
    })
  }

  return index
}
