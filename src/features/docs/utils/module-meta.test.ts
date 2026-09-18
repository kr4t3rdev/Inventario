import { describe, expect, it } from 'vitest';

import {
  buildDocsBreadcrumbSchema,
  buildDocsModuleMetadata,
  getDocsModulePresentation,
} from '@/features/docs/utils/module-meta';
import { siteConfig } from '@/lib/seo/site';

describe('docs module metadata helpers', () => {
  it('builds enriched metadata for a docs module', () => {
    const metadata = buildDocsModuleMetadata('productos');

    expect(metadata.title).toBe(`Productos — Documentación ${siteConfig.name}`);
    expect(metadata.description).toBe('Administra tu catálogo, precios y stock desde un solo lugar.');
    expect(metadata.alternates?.canonical).toBe(`${siteConfig.url}/docs/productos`);
  });

  it('builds ordered breadcrumb schema for a docs module', () => {
    const schema = buildDocsBreadcrumbSchema('contabilidad/periodos-contables');

    expect(schema?.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Documentación',
        item: `${siteConfig.url}/docs`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Contabilidad y Finanzas',
        item: `${siteConfig.url}/docs`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Periodos Contables',
        item: `${siteConfig.url}/docs/contabilidad/periodos-contables`,
      },
    ]);
  });

  it('derives freshness data from the markdown source file', () => {
    const presentation = getDocsModulePresentation('productos');

    expect(presentation.lastUpdatedIso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(presentation.lastUpdatedLabel).toBeTruthy();
  });
});
