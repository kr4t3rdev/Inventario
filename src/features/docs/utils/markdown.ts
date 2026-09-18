/**
 * @description Utilidades para leer archivos markdown en build-time.
 * Solo se ejecuta en el servidor durante la compilación (SSG).
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { DOCS_MODULES_DIR, DOCS_MODULES_INDEX_PATH } from "@/features/docs/utils/content-paths"

/**
 * @description Lee el contenido de un archivo markdown dado un slug.
 * Maneja slugs planos (productos) y anidados (contabilidad/periodos-contables).
 * @param slug - Slug del módulo (e.g. "productos", "contabilidad/periodos-contables")
 * @returns Contenido del markdown o null si no existe
 */
export function readModuleContent(slug: string): string | null {
  // Slugs anidados: "contabilidad/periodos-contables" → content/docs/modules/contabilidad/periodos-contables.md
  const parts = slug.split("/")

  if (parts.length === 1) {
    // Módulo plano: content/docs/modules/{slug}/README.md
    const filePath = join(DOCS_MODULES_DIR, parts[0]!, "README.md")
    try {
      return readFileSync(filePath, "utf-8")
    } catch {
      return null
    }
  }

  if (parts.length === 2) {
    // Módulo anidado: content/docs/modules/{dir}/{subpage}.md
    const filePath = join(DOCS_MODULES_DIR, parts[0]!, `${parts[1]}.md`)
    try {
      return readFileSync(filePath, "utf-8")
    } catch {
      return null
    }
  }

  return null
}

/**
 * @description Lee el índice global de módulos (`content/docs/modules/INDEX.md`).
 * @returns Contenido del índice o null si no existe.
 */
export function readDocsModulesIndexContent(): string | null {
  try {
    return readFileSync(DOCS_MODULES_INDEX_PATH, "utf-8")
  } catch {
    return null
  }
}

/**
 * @description Obtiene el slide del path del archivo markdown
 */
export function getMarkdownFilePath(slug: string): string | null {
  const parts = slug.split("/")

  if (parts.length === 1) {
    return join(DOCS_MODULES_DIR, parts[0]!, "README.md")
  }

  if (parts.length === 2) {
    return join(DOCS_MODULES_DIR, parts[0]!, `${parts[1]}.md`)
  }

  return null
}
