import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Directorios de los módulos de operaciones auditados con Impeccable:
 * compras de productos, facturas, mermas, servicios, ventas, empleados
 * (vacaciones y nómina), ofertas y clientes.
 */
const SCOPE_DIRS = [
  'src/features/compras-productos',
  'src/features/facturas',
  'src/features/mermas',
  'src/features/servicios',
  'src/features/ventas',
  'src/features/empleados',
  'src/features/ofertas',
  'src/features/clientes',
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

describe('operaciones modules UI audit (Impeccable fixes)', () => {
  it('no usa la paleta AI (purple/violet/indigo hardcoded) en módulos de operaciones', () => {
    const pattern = /\b(text|from|to|border|bg)-(?:purple|violet|indigo)-\d+\b/g;
    const findings = collectScopeFiles().flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return [...source.matchAll(pattern)].map((m) => `${file}: ${m[0]}`);
    });
    expect(findings).toEqual([]);
  });

  it('no usa el antipatrón side-tab (border-l-4) en los componentes de empleados', () => {
    const files = [
      'src/features/empleados/components/nomina-view.tsx',
      'src/features/empleados/components/vacaciones-form.tsx',
    ];
    const findings = files.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return [...source.matchAll(/border-l-4/g)].map(() => file);
    });
    expect(findings).toEqual([]);
  });

  it('no deja botones icon-only sin aria-label en las tablas de acciones', () => {
    // Archivos con botones icon-only de acciones auditados manualmente.
    const files = [
      'src/features/compras-productos/components/compras-productos-content.tsx',
      'src/features/facturas/components/facturas-content.tsx',
      'src/features/mermas/components/editar-merma-content.tsx',
      'src/features/mermas/components/nueva-merma-content.tsx',
      'src/features/mermas/components/mermas-table.tsx',
      'src/features/servicios/components/servicios-content.tsx',
      'src/features/ventas/components/ventas-table.tsx',
      'src/features/ofertas/components/oferta-detail-content.tsx',
      'src/features/ofertas/components/quick-offer-dialog.tsx',
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
