/**
 * @description Contrato estático de español neutro para auth/onboarding (PE-01).
 * Primer texto que ve un usuario nuevo: ningún archivo del ciclo de identidad
 * puede contener voseo rioplatense. Réplica del patrón del test de landing.
 * @module src/features/auth/__tests__/neutral-spanish-copy.test
 */
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
  'usás',
  'registrás',
  'registrate',
  'registrá',
  'creás',
  'creá',
  'verificás',
  'verificá',
  'completás',
  'completá',
  'probá',
  'hacé',
  'elegí',
  'compartí',
  'convertí',
  'recomendá',
  'recibí',
  'cobrá',
  'conocé',
  'contactá',
  'seleccioná',
  'iniciá',
  'activá',
  'solicitá',
  'empezá',
  'revisá',
  'modificá',
  'editá',
  'reintentá',
  'guardá',
  'esperá',
  'accedé',
  'ingresá',
  'intentá',
  'intentalo',
] as const;

const SCANNED_DIRECTORIES = [
  'src/features/auth',
  'src/app/api/auth',
  'src/app/api/mobile/v1/auth',
  'src/app/onboarding',
];

const SCANNED_FILES = ['src/lib/services/tenant-factory.ts'];

/**
 * @description Recorre recursivamente un directorio recolectando fuentes TS/TSX
 * (excluye tests: el contrato aplica a copy de producción, no a fixtures).
 * @param {string} directory - Directorio raíz a recorrer.
 * @returns {string[]} Rutas de archivos fuente.
 */
function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) return [];
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : [];
  });
}

/**
 * @description Detecta una palabra completa (con soporte de tildes Unicode).
 * @param {string} source - Código fuente a inspeccionar.
 * @param {string} word - Palabra prohibida.
 * @returns {boolean} true si la palabra aparece como término completo.
 */
function containsWholeWord(source: string, word: string): boolean {
  const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(?<![\\p{L}\\p{N}_])${escapedWord}(?![\\p{L}\\p{N}_])`,
    'iu',
  ).test(source);
}

describe('auth/onboarding neutral Spanish copy', () => {
  it('detects voseo ending in accented Unicode letters', () => {
    expect(containsWholeWord('Revisá tu correo', 'revisá')).toBe(true);
    expect(containsWholeWord('No tenés acceso', 'tenés')).toBe(true);
    expect(containsWholeWord('Intentalo de nuevo', 'intentalo')).toBe(true);
    expect(containsWholeWord('Revisa tu correo', 'revisá')).toBe(false);
  });

  it('does not use Argentine or Rioplatense voseo in identity flows', () => {
    const files = [
      ...SCANNED_DIRECTORIES.flatMap((directory) => collectSourceFiles(directory)),
      ...SCANNED_FILES,
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
