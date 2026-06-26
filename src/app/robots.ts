import type { MetadataRoute } from 'next';

import {
  buildCanonicalUrl,
  PRIVATE_ROUTE_PREFIXES,
  siteConfig,
} from '@/lib/seo/site';

/**
 * @description Define reglas de rastreo para contenido público y bloquea áreas operativas.
 * @returns {MetadataRoute.Robots} Configuración de robots.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE_ROUTE_PREFIXES.map((prefix) => `${prefix}/`),
      },
    ],
    sitemap: buildCanonicalUrl('/sitemap.xml'),
    host: siteConfig.url,
  };
}
