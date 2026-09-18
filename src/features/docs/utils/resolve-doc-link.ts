/**
 * @description Convierte links markdown relativos a rutas amigables de /docs.
 * Soporta README.md, subpáginas .md y anchors opcionales.
 * @param {string} href - Href original encontrado en markdown.
 * @returns {string} Ruta transformada si corresponde; en caso contrario, el href original.
 */
export function resolveDocLink(href: string): string {
  if (!href || href.startsWith('#')) {
    return href;
  }

  if (/^[a-z]+:/i.test(href) || href.startsWith('//')) {
    return href;
  }

  const [pathname, hash = ''] = href.split('#');

  if (!pathname?.endsWith('.md')) {
    return href;
  }

  const normalizedPath = pathname.replace(/^\.\//, '').replace(/\.md$/, '');
  const cleanPath = normalizedPath.replace(/\/README$/, '');

  if (!cleanPath) {
    return href;
  }

  return `/docs/${cleanPath}${hash ? `#${hash}` : ''}`;
}
