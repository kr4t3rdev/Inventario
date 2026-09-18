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
] as const;

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    if (entry.name === 'neutral-spanish-copy.test.ts') return [];
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : [];
  });
}

function containsWholeWord(source: string, word: string): boolean {
  const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(?<![\\p{L}\\p{N}_])${escapedWord}(?![\\p{L}\\p{N}_])`,
    'iu',
  ).test(source);
}

describe('landing neutral Spanish copy', () => {
  it('detects voseo ending in accented Unicode letters', () => {
    expect(containsWholeWord('Ahora probá el sistema', 'probá')).toBe(true);
    expect(containsWholeWord('Elegí tu plan', 'elegí')).toBe(true);
    expect(containsWholeWord('Una palabra sin coincidencia', 'probá')).toBe(false);
  });

  it('does not use Argentine or Rioplatense voseo', () => {
    const files = [
      ...collectSourceFiles('src/features/landing'),
      ...collectSourceFiles('src/features/reviews'),
    ];

    const findings = files.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return BANNED_VOSEO_WORDS.flatMap((word) =>
        containsWholeWord(source, word) ? [`${file}: ${word}`] : [],
      );
    });

    expect(findings).toEqual([]);
  });
});
