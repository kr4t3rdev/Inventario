import type { MetadataRoute } from 'next';

import { buildAllSlugs } from '@/features/docs/utils/registry';
import { buildCanonicalUrl, buildPublicPageUrls, PUBLIC_ROUTE_PATHS } from '@/lib/seo/site';

/**
 * @description Genera el sitemap público con la landing y toda la documentación indexable.
 * @returns {MetadataRoute.Sitemap} Entradas del sitemap.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const publicPages = buildPublicPageUrls(PUBLIC_ROUTE_PATHS).map((url) => ({
    url,
  }));

  const docsPages = buildAllSlugs().map((slug) => ({
    url: buildCanonicalUrl(`/docs/${slug}`),
  }));

  return [...publicPages, ...docsPages];
}
