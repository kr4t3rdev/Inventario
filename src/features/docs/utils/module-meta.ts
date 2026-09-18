import { statSync } from 'node:fs';

import type { Metadata } from 'next';

import { getModuleBySlug } from '@/features/docs/data/domains';
import { getMarkdownFilePath } from '@/features/docs/utils/markdown';
import { buildCanonicalUrl, siteConfig } from '@/lib/seo/site';

interface BreadcrumbItem {
  '@type': 'ListItem';
  position: number;
  name: string;
  item: string;
}

interface BreadcrumbSchema {
  '@context': 'https://schema.org';
  '@type': 'BreadcrumbList';
  itemListElement: BreadcrumbItem[];
}

export interface DocsModulePresentation {
  lastUpdatedIso: string | null;
  lastUpdatedLabel: string | null;
}

/**
 * @description Construye metadata enriquecida para páginas de módulos de documentación.
 * @param {string} slug - Slug del módulo.
 * @returns {Metadata} Metadata lista para Next.js.
 */
export function buildDocsModuleMetadata(slug: string): Metadata {
  const mod = getModuleBySlug(slug);

  if (!mod) {
    return { title: `Módulo no encontrado — ${siteConfig.name}` };
  }

  const canonical = buildCanonicalUrl(`/docs/${slug}`);
  const title = `${mod.title} — Documentación ${siteConfig.name}`;

  return {
    title,
    description: mod.description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description: mod.description,
      url: canonical,
      siteName: siteConfig.name,
      locale: 'es_ES',
      type: 'article',
    },
  };
}

/**
 * @description Genera el schema breadcrumb para una página de documentación.
 * @param {string} slug - Slug del módulo.
 * @returns {BreadcrumbSchema | null} Schema breadcrumb o null si el módulo no existe.
 */
export function buildDocsBreadcrumbSchema(slug: string): BreadcrumbSchema | null {
  const mod = getModuleBySlug(slug);

  if (!mod) {
    return null;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Documentación',
        item: buildCanonicalUrl('/docs'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: mod.domain,
        item: buildCanonicalUrl('/docs'),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: mod.title,
        item: buildCanonicalUrl(`/docs/${slug}`),
      },
    ],
  };
}

/**
 * @description Deriva una fecha de última actualización confiable desde el archivo markdown fuente.
 * @param {string} slug - Slug del módulo.
 * @returns {DocsModulePresentation} Fechas cruda y formateada para UI/schema.
 */
export function getDocsModulePresentation(slug: string): DocsModulePresentation {
  const filePath = getMarkdownFilePath(slug);

  if (!filePath) {
    return { lastUpdatedIso: null, lastUpdatedLabel: null };
  }

  try {
    const stats = statSync(filePath);
    const iso = stats.mtime.toISOString();
    const label = new Intl.DateTimeFormat('es', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(stats.mtime);

    return {
      lastUpdatedIso: iso,
      lastUpdatedLabel: label,
    };
  } catch {
    return { lastUpdatedIso: null, lastUpdatedLabel: null };
  }
}
