import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const BANNED_VOSEO_WORDS = [
  'vos',
  'sos',
  'tenés',
  'querés',
  'podés',
  'necesitás',
  'calificás',
  'usás',
  'ganás',
  'cobrás',
  'consultás',
  'compartís',
  'recibís',
  'registrás',
  'creás',
  'verificás',
  'completás',
  'definís',
  'manejás',
  'probá',
  'hacé',
  'vení',
  'decí',
  'poné',
  'mirá',
  'ganá',
  'elegí',
  'compartí',
  'convertí',
  'recomendá',
  'registrate',
  'recibí',
  'cobrá',
  'escalá',
  'evolucioná',
  'conocé',
  'vendé',
  'comprá',
  'mové',
  'coordiná',
  'controlá',
  'olvidate',
  'contactá',
  'seleccioná',
  'contanos',
  'iniciá',
  'activá',
  'sumate',
  'solicitá',
  'hablá',
  'empezá',
  'llevá',
  'gestioná',
  'optimizá',
  'revisá',
  'modificá',
  'editá',
  'cambié',
  'cambia',
  'reintentá',
  'usá',
  'guardá',
  'cargá',
  'asigná',
  'eliminá',
  'buscá',
  'filtrá',
  'renová',
  'copiá',
  'esperá',
  'accedé',
] as const;

/** Palabras voseo que también son verbos neutros en imperativo (ej: "cambia") y solo se marcan en contexto adjetival/nominal */
const CONTEXTUAL_WORDS = new Set(['cambia']);

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

function containsWholeWord(source: string, word: string): boolean {
  const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(?<![\\p{L}\\p{N}_])${escapedWord}(?![\\p{L}\\p{N}_])`,
    'iu',
  ).test(source);
}

function findVoseoMatches(source: string): string[] {
  const candidates = BANNED_VOSEO_WORDS.filter(
    (word) => word.length >= 4 || !CONTEXTUAL_WORDS.has(word),
  );
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}_])(?:${candidates
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')})(?![\\p{L}\\p{N}_])`,
    'giu',
  );
  return [...new Set(source.match(pattern) ?? [])];
}

describe('admin panel neutral Spanish copy', () => {
  it('detects voseo ending in accented Unicode letters', () => {
    expect(containsWholeWord('Ahora editá el plan', 'editá')).toBe(true);
    expect(containsWholeWord('Modificá el plan', 'modificá')).toBe(true);
    expect(containsWholeWord('Una palabra sin coincidencia', 'probá')).toBe(false);
  });

  it(
    'does not use Argentine or Rioplatense voseo in admin panel copy',
    () => {
      const files = [
        ...collectSourceFiles('src/app/admin'),
        ...collectSourceFiles('src/features/admin'),
        ...collectSourceFiles('src/components/admin-sidebar.tsx'),
        ...collectSourceFiles('src/components/admin-header.tsx'),
      ];

      const findings = files.flatMap((file) => {
        const source = readFileSync(file, 'utf8');
        return findVoseoMatches(source).map((word) => `${file}: ${word}`);
      });

      expect(findings).toEqual([]);
    },
    30000,
  );
});