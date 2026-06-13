/**
 * @description Tipos compartidos para el módulo de documentación pública.
 */

export interface DocModule {
  /** Slug único para la ruta (e.g. "productos", "contabilidad/periodos-contables") */
  slug: string
  /** Nombre visible del módulo */
  title: string
  /** Descripción breve (primer párrafo del README) */
  description: string
  /** Nombre del dominio al que pertenece */
  domain: string
  /** Icono emoji del dominio */
  domainIcon: string
}

export interface DocDomain {
  /** Nombre del dominio */
  name: string
  /** Icono emoji */
  icon: string
  /** Módulos que pertenecen a este dominio */
  modules: DocModule[]
}

export interface SearchIndexEntry {
  slug: string
  title: string
  domain: string
  description: string
  content: string
}
