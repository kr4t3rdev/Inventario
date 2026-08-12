import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Directorios del módulo de contabilidad auditados con Impeccable.
 */
const SCOPE_DIRS = [
  'src/features/contabilidad/components',
  'src/app/busy/contabilidad',
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

describe('contabilidad scope UI audit (Impeccable fixes)', () => {
  it('no deja side-tab (border-l-4) en tarjetas de contabilidad', () => {
    const findings = collectScopeFiles()
      .filter((file) => file.endsWith('.tsx'))
      .filter((file) => /border-l-4/.test(readFileSync(file, 'utf8')));
    expect(findings).toEqual([]);
  });

  it('no deja spinners con border accent en cards redondeadas (border-b-2 sobre rounded-full)', () => {
    const findings = collectScopeFiles()
      .filter((file) => file.endsWith('.tsx'))
      .filter((file) => /border-b-2\s+border-\w+-\d+|border-\w+-\d+\s+border-b-2/.test(readFileSync(file, 'utf8')));
    expect(findings).toEqual([]);
  });

  it('no deja texto gris lavado sobre fondos de color (text-gray-400 sobre bg-blue-50)', () => {
    const files = [
      'src/features/contabilidad/components/reconciliacion/reconciliacion-gastos-form.tsx',
    ];
    const findings = files.filter((file) => /bg-blue-50.*text-gray-400|text-gray-400.*bg-blue-50/.test(readFileSync(file, 'utf8')));
    expect(findings).toEqual([]);
  });

  it('no deja botones icon-only sin aria-label en anticipos-table', () => {
    const source = readFileSync('src/features/contabilidad/components/anticipos/anticipos-table.tsx', 'utf8');
    const re = /<Button\b[^>]*>([\s\S]*?)<\/Button>/g;
    const bad: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(source))) {
      const attrs = m[0];
      const inner = m[1];
      const hasAria = /aria-label=/.test(attrs);
      const hasText = /[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(inner.replace(/<[^>]+>/g, ''));
      const hasIcon = /<[A-Z][A-Za-z]*\s|className=/i.test(inner);
      if (hasIcon && !hasText && !hasAria) bad.push(`anticipos-table.tsx:${source.slice(0, m.index).split('\n').length}`);
    }
    expect(bad).toEqual([]);
  });
});
