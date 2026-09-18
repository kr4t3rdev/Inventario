/**
 * @description Test de copy en español neutro para el módulo de servicios.
 * Replica el patrón del test de landing: escanea los fuentes del feature y
 * falla si aparece voseo o errores ortográficos conocidos.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const BANNED_VOSEO_WORDS = [
  'completá',
  'seleccioná',
  'registrá',
  'agregá',
  'probá',
  'hacé',
  'elegí',
  'tenés',
  'querés',
  'podés',
] as const;

const BANNED_TYPOS = ['periodicó'] as const;

const FEATURE_ROOT = join(process.cwd(), 'src/features/servicios');

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

describe('servicios neutral Spanish copy', () => {
  it('no contiene voseo ni typos conocidos en UI copy', () => {
    const files = collectSourceFiles(FEATURE_ROOT);
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf-8');
      for (const word of [...BANNED_VOSEO_WORDS, ...BANNED_TYPOS]) {
        if (containsWholeWord(source, word)) {
          offenders.push(`${file}: "${word}"`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
