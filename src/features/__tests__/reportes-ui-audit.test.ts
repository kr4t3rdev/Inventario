import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Directorios de los módulos auditados con Impeccable: reportes/dashboard/KPIs,
 * configuración/Mi Empresa/usuarios y login/autenticación.
 */
const SCOPE_DIRS = [
  'src/features/dashboard',
  'src/features/reportes-financieros',
  'src/features/configuracion',
  'src/features/mi-empresa',
  'src/features/auth/components',
  'src/app/login',
  'src/app/register',
  'src/app/busy/dashboard',
  'src/app/busy/reportes',
  'src/app/busy/configuracion',
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

describe('reportes/dashboard/auth scope UI audit (Impeccable fixes)', () => {
  it('no usa la paleta AI (purple/violet/indigo/fuchsia hardcoded) en reportes, dashboard y auth', () => {
    const pattern = /\b(text|from|to|border|bg|hover:border|hover:bg)-(?:purple|violet|indigo|fuchsia)-\d+\b/g;
    const findings = collectScopeFiles().flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return [...source.matchAll(pattern)].map((m) => `${file}: ${m[0]}`);
    });
    expect(findings).toEqual([]);
  });

  it('no deja side-tab (border-l-4) en las tarjetas de métricas de reportes', () => {
    const files = [
      'src/features/reportes-financieros/components/reporte-general.tsx',
      'src/features/reportes-financieros/components/reporte-por-ubicacion.tsx',
      'src/features/reportes-financieros/components/reporte-venta-diaria.tsx',
    ];
    const findings = files.filter((file) => /border-l-4/.test(readFileSync(file, 'utf8')));
    expect(findings).toEqual([]);
  });

  it('no usa voseo rioplatense en el copy del dashboard y auth', () => {
    const files = [
      'src/app/busy/dashboard/page.tsx',
      'src/app/login/page.tsx',
      'src/app/register/page.tsx',
    ];
    const findings = files.filter((file) => /seleccioná|usá|probá|elegí|tenés|querés|podés|hacé/.test(readFileSync(file, 'utf8')));
    expect(findings).toEqual([]);
  });

  it('no deja toggles de contraseña icon-only sin aria-label en login/register', () => {
    const files = [
      'src/app/login/page.tsx',
      'src/app/register/page.tsx',
    ];
    const findings = files.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const re = /<motion\.button\b[^>]*>([\s\S]*?)<\/motion\.button>/g;
      const bad: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(source))) {
        const attrs = m[0];
        const inner = m[1];
        const hasAria = /aria-label=/.test(attrs);
        const hasText = /[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(inner.replace(/<[^>]+>/g, ''));
        const hasIcon = /<[A-Z][A-Za-z]*\s|className=/i.test(inner);
        if (hasIcon && !hasText && !hasAria) bad.push(`${file}:${source.slice(0, m.index).split('\n').length}`);
      }
      return bad;
    });
    expect(findings).toEqual([]);
  });
});
