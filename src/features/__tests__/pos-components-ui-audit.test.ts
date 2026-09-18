import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Directorios de los módulos auditados con Impeccable: panel de ventas (POS),
 * venta de servicios, turnos POS, arqueos de caja y componentes compartidos.
 */
const SCOPE_DIRS = [
  'src/features/ventas/components',
  'src/features/venta-servicios',
  'src/features/turnos-pos/components',
  'src/features/arqueo-caja/components',
  'src/app/busy/caja',
  'src/components/admin',
  'src/components/ui',
  'src/components/Loaders',
  'src/components/animations',
  'src/components/cards',
  'src/components/sugerencias',
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

describe('POS + shared components scope UI audit (Impeccable fixes)', () => {
  it('no usa la paleta AI (purple/violet/indigo/fuchsia hardcoded) en POS y componentes compartidos', () => {
    const pattern = /\b(text|from|to|border|bg|hover:border|hover:bg)-(?:purple|violet|indigo|fuchsia)-\d+\b/g;
    const findings = collectScopeFiles().flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return [...source.matchAll(pattern)].map((m) => `${file}: ${m[0]}`);
    });
    expect(findings).toEqual([]);
  });

  it('no deja botones icon-only sin aria-label en pv-interface', () => {
    const source = readFileSync('src/features/ventas/components/pv-interface.tsx', 'utf8');
    const re = /<motion\.button\b[^>]*>([\s\S]*?)<\/motion\.button>/g;
    const bad: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(source))) {
      const attrs = m[0];
      const inner = m[1];
      const hasAria = /aria-label=/.test(attrs);
      const hasText = /[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(inner.replace(/<[^>]+>/g, ''));
      const hasIcon = /<[A-Z][A-Za-z]*\s|className=/i.test(inner);
      if (hasIcon && !hasText && !hasAria) bad.push(`pv-interface.tsx:${source.slice(0, m.index).split('\n').length}`);
    }
    expect(bad).toEqual([]);
  });

  it('no usa voseo rioplatense en el copy de turnos POS', () => {
    const source = readFileSync('src/features/turnos-pos/components/cuadres-history-page-client.tsx', 'utf8');
    expect(source).not.toMatch(/Revisá|abrí|usá|seleccioná|probá|elegí/);
  });

  it('no deja bounce/elastic easing ni animación de width en el gráfico de turnos', () => {
    const source = readFileSync('src/components/sugerencias/wanda/shift-billing-bar-chart.tsx', 'utf8');
    expect(source).not.toMatch(/cubic-bezier\([^)]*,[^)]*,[^)]*,[^)]*\)/);
    expect(source).not.toMatch(/transition: 'width/);
    expect(source).toMatch(/scaleX\(/);
  });
});
