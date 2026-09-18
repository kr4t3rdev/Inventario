import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

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

  it('no deja spinners con border accent en cards redondeadas', () => {
    const findings = collectScopeFiles()
      .filter((file) => file.endsWith('.tsx'))
      .filter((file) => /border-b-2\s+border-\w+-\d+|border-\w+-\d+\s+border-b-2/.test(readFileSync(file, 'utf8')));
    expect(findings).toEqual([]);
  });

  it('no deja texto gris lavado sobre fondos de color', () => {
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

describe('Fase 5 — Accesibilidad, responsive y copy', () => {
  const scopeTsx = collectSourceFiles('src/features/contabilidad/components')
    .filter(f => f.endsWith('.tsx'));

  describe('Foco visible', () => {
    it('ningún outline-none sin focus-visible equivalente', () => {
      const findings = scopeTsx.filter((file) => {
        const src = readFileSync(file, 'utf8');
        const lines = src.split('\n');
        return lines.some(line => {
          const hasOutlineNone = /outline-none/.test(line);
          const hasFocusVisible = /focus-visible:/.test(line);
          return hasOutlineNone && !hasFocusVisible;
        });
      });
      expect(findings).toEqual([]);
    });

    it('elementos onClick sin role="button" tienen aria-label si son icon-only', () => {
      const findings = scopeTsx.filter(f => {
        const src = readFileSync(f, 'utf8');
        const lines = src.split('\n');
        return lines.some(line => {
          const isClickable = /onClick/.test(line) && !/role="button"|<Button|<button/.test(line);
          const hasIcon = /<Icon\b|<Lucide|<Arrow|className="[^"]*icon/.test(line);
          const hasLabel = /aria-label/.test(line);
          return isClickable && hasIcon && !hasLabel;
        });
      });
      expect(findings).toEqual([]);
    });
  });

  describe('Targets táctiles', () => {
    it('botones de texto tienen min-h-11 (44px)', () => {
      const findings = scopeTsx.filter((file) => {
        const src = readFileSync(file, 'utf8');
        const lines = src.split('\n');
        return lines.some(line => {
          const isButton = /<Button\b/.test(line);
          const hasSmallHeight = /\bh-[0-9]\b/.test(line);
          const isSmallOrIcon = /size="(icon|sm)"|w-[0-9]\b.*p-0|aria-label|text-xs\s+uppercase/.test(line);
          return isButton && hasSmallHeight && !isSmallOrIcon;
        });
      });
      expect(findings).toEqual([]);
    });

    it('inputs tienen min-height adecuado', () => {
      const findings = scopeTsx.filter((file) => {
        const src = readFileSync(file, 'utf8');
        const hasTinyInput = /<Input[^>]*className="[^"]*h-[0-8]\b/.test(src);
        return hasTinyInput;
      });
      expect(findings).toEqual([]);
    });
  });

  describe('Tablas accesibles', () => {
    it('todas las tablas tienen thead y tbody', () => {
      const findings = scopeTsx.filter((file) => {
        const src = readFileSync(file, 'utf8');
        const hasTable = /<Table\b/.test(src);
        const hasThead = /<TableHeader\b/.test(src);
        const hasTbody = /<TableBody\b|<motion\.tbody\b/.test(src);
        return hasTable && (!hasThead || !hasTbody);
      });
      expect(findings).toEqual([]);
    });

    it('ningún TableCell sin contenido accesible (no solo icono)', () => {
      const findings = scopeTsx.filter((file) => {
        const src = readFileSync(file, 'utf8');
        const emptyCell = /<TableCell[^>]*>\s*<\/TableCell>/g;
        return emptyCell.test(src);
      });
      expect(findings).toEqual([]);
    });
  });

  describe('Español neutro — copy contable', () => {
    const NEUTRAL_PATTERNS = [
      { regex: /Seleccioná/gi, label: 'voseo: Seleccioná' },
      { regex: /Mirá/gi, label: 'voseo: Mirá' },
      { regex: /Creá/gi, label: 'voseo: Creá' },
      { regex: /Elegí/gi, label: 'voseo: Elegí' },
      { regex: /Compartí/gi, label: 'voseo: Compartí' },
      { regex: /Ganá/gi, label: 'voseo: Ganá' },
      { regex: /Cobrá/gi, label: 'voseo: Cobrá' },
      { regex: /Registrate/gi, label: 'voseo: Registrate' },
      { regex: /\bSos\b/gi, label: 'voseo: Sos' },
      { regex: /Tenés/gi, label: 'voseo: Tenés' },
      { regex: /Querés/gi, label: 'voseo: Querés' },
      { regex: /Podés/gi, label: 'voseo: Podés' },
      { regex: /Probá/gi, label: 'voseo: Probá' },
      { regex: /Hacé/gi, label: 'voseo: Hacé' },
    ];

    it('no contiene voseo en componentes de contabilidad', () => {
      const findings: string[] = [];
      for (const file of scopeTsx) {
        const src = readFileSync(file, 'utf8');
        for (const { regex, label } of NEUTRAL_PATTERNS) {
          const matches = src.match(regex);
          if (matches) {
            const shortPath = file.replace('src/features/contabilidad/components/', '');
            findings.push(`${shortPath}: ${label} (${matches.length}x)`);
          }
        }
      }
      expect(findings).toEqual([]);
    });

    it('no contiene voseo en tests de contabilidad (excepto assertions)', () => {
      const testFiles = scopeTsx
        .map(f => f.replace('.tsx', '.test.tsx'))
        .filter(f => { try { return readFileSync(f, 'utf8').length > 0; } catch { return false; } });

      const findings: string[] = [];
      for (const file of testFiles) {
        const src = readFileSync(file, 'utf8');
        const lines = src.split('\n');
        for (const { regex, label } of NEUTRAL_PATTERNS) {
          for (const line of lines) {
            const isAssertion = /expect\(|\.toMatch\(|\.toContain\(|\.toEqual\(/.test(line);
            if (!isAssertion && regex.test(line)) {
              const shortPath = file.replace('src/features/contabilidad/', '');
              findings.push(`${shortPath}: ${label}`);
            }
          }
        }
      }
      expect(findings).toEqual([]);
    });

    it('labels de filtros usan copy neutro (Seleccione, no Seleccioná)', () => {
      const findings: string[] = [];
      for (const file of scopeTsx) {
        const src = readFileSync(file, 'utf8');
        if (/Seleccioná/.test(src)) {
          findings.push(file.replace('src/features/contabilidad/components/', ''));
        }
      }
      expect(findings).toEqual([]);
    });
  });

  describe('Reduced motion', () => {
    it('componentes con whileHover/whileTap usan useReducedMotion o son motion básicos', () => {
      const findings = scopeTsx.filter((file) => {
        const src = readFileSync(file, 'utf8');
        const hasComplexAnimation = /whileHover|whileTap|whileDrag/.test(src);
        const respectsReduced = /useReducedMotion|shouldReduceMotion/.test(src);
        const usesMotionProxy = /motion\.(div|span|button|tr|tbody)/.test(src);
        return hasComplexAnimation && !respectsReduced && !usesMotionProxy;
      });
      expect(findings).toEqual([]);
    });
  });

  describe('Estructura de columnas', () => {
    it('skeleton de loading tiene mismo número de celdas por fila que el thead', () => {
      const findings = scopeTsx.filter((file) => {
        const src = readFileSync(file, 'utf8');
        const theadCols = (src.match(/<TableHead\b/g) || []).length;
        const skeletonMatch = src.match(/Array\.from\(\{\s*length:\s*\d+\s*\}\)\.map\([^)]*\)\s*(?:=>\s*)?\(\s*\(\s*\)\s*=>\s*\(([\s\S]*?)\)\s*\)/);
        if (theadCols > 0 && skeletonMatch) {
          const skeletonCells = (skeletonMatch[1].match(/<TableCell\b/g) || []).length;
          return skeletonCells !== theadCols;
        }
        return false;
      });
      expect(findings).toEqual([]);
    });

    it('empty state colspan (sin font-semibold) coincide con columnas', () => {
      const findings = scopeTsx.filter((file) => {
        const src = readFileSync(file, 'utf8');
        const theadCols = (src.match(/<TableHead\b/g) || []).length;
        if (theadCols === 0) return false;
        const lines = src.split('\n');
        return lines.some(line => {
          const hasColSpan = /colSpan=\{(\d+)\}/.test(line);
          const isTotalRow = /font-semibold|border-t-2/.test(line);
          if (hasColSpan && !isTotalRow) {
            const match = line.match(/colSpan=\{(\d+)\}/);
            if (match) {
              const colspan = parseInt(match[1]);
              return colspan > theadCols;
            }
          }
          return false;
        });
      });
      expect(findings).toEqual([]);
    });

    it('periodos timeline colspan coincide con columnas reales (regresión)', () => {
      const file = 'src/features/contabilidad/components/periodos/periodos-page-client.tsx';
      const src = readFileSync(file, 'utf8');
      const theadCols = (src.match(/<TableHead\b/g) || []).length;
      expect(theadCols).toBeGreaterThan(0);
      const colspans = [...src.matchAll(/colSpan=\{(\d+)\}/g)].map(m => parseInt(m[1]));
      for (const cs of colspans) {
        expect(cs).toBeLessThanOrEqual(theadCols);
      }
    });
  });
});
