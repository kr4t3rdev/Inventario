import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Directorios de los módulos auditados con Impeccable: productos y su
 * envoltorio (categorías, almacenes, puntos de venta, proveedores,
 * listas de precios y unidades).
 */
const SCOPE_DIRS = [
  'src/features/productos',
  'src/features/categorias',
  'src/features/almacenes',
  'src/features/puntos-venta',
  'src/features/vendors',
  'src/features/listas-precios',
  'src/features/unidades',
];

function collectSourceFiles(directory: string): string[] {
  if (!directory) return [];
  try {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return collectSourceFiles(path);
      if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) return [];
      return ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : [];
    });
  } catch {
    return [];
  }
}

function collectScopeFiles(): string[] {
  return SCOPE_DIRS.flatMap(collectSourceFiles);
}

describe('productos scope UI audit (Impeccable fixes)', () => {
  it('no usa la paleta AI (purple/violet/indigo hardcoded) en productos y su envoltorio', () => {
    const pattern = /\b(text|from|to|border|bg|hover:border|hover:bg)-(?:purple|violet|indigo)-\d+\b/g;
    const findings = collectScopeFiles().flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return [...source.matchAll(pattern)].map((m) => `${file}: ${m[0]}`);
    });
    expect(findings).toEqual([]);
  });

  it('no usa voseo rioplatense en el copy de categorías', () => {
    const source = readFileSync('src/features/categorias/components/subcategory-selector.tsx', 'utf8');
    expect(source).not.toMatch(/seleccioná|usá|probá|elegí/);
  });

  it('no deja botones icon-only sin aria-label en las tablas y páginas de productos', () => {
    const files = [
      'src/features/productos/components/productos-content.tsx',
      'src/features/categorias/components/categoria-page-client.tsx',
      'src/features/almacenes/components/almacen-page-client.tsx',
      'src/features/puntos-venta/components/pv-page-client.tsx',
      'src/features/vendors/components/vendor-page-client.tsx',
      'src/features/vendors/components/vendor-edit-page-client.tsx',
      'src/features/vendors/components/vendor-new-page-client.tsx',
      'src/features/unidades/components/unidad-page-client.tsx',
    ];
    const findings = files.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const re = /<Button\b[^>]*>([\s\S]*?)<\/Button>/g;
      const bad: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(source))) {
        const attrs = m[0];
        const inner = m[1];
        const hasAria = /aria-label=/.test(attrs);
        const hasText = /[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(inner.replace(/<[^>]+>/g, ''));
        const hasIcon = /<[A-Z][A-Za-z]*\s|size=|className=/i.test(inner);
        if (hasIcon && !hasText && !hasAria) bad.push(`${file}:${source.slice(0, m.index).split('\n').length}`);
      }
      return bad;
    });
    expect(findings).toEqual([]);
  });
});
