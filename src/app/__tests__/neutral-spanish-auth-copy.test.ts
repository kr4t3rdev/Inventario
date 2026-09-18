import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const BANNED_VOSEO_WORDS = [
  'tenés',
  'tienés',
  'ingresá',
  'ingresás',
  'verificá',
  'verificás',
  'continuá',
  'continuás',
  'registrate',
  'iniciá',
  'iniciás',
  'completá',
  'completás',
  'repetí',
  'repetís',
  'querés',
  'podés',
  'sos',
  'hacé',
  'probá',
  'elegí',
  'usás',
] as const;

const AUTH_PAGES = ['src/app/login/page.tsx', 'src/app/register/page.tsx'] as const;

function containsWholeWord(source: string, word: string): boolean {
  const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(?<![\\p{L}\\p{N}_])${escapedWord}(?![\\p{L}\\p{N}_])`,
    'iu',
  ).test(source);
}

describe('auth neutral Spanish copy', () => {
  it('detects voseo endings in accented Unicode letters', () => {
    expect(containsWholeWord('Ingresá tus credenciales', 'ingresá')).toBe(true);
    expect(containsWholeWord('¿No tenés una cuenta?', 'tenés')).toBe(true);
    expect(containsWholeWord('Ingresa tus credenciales', 'ingresá')).toBe(false);
  });

  it('login and register pages do not use Argentine or Rioplatense voseo', () => {
    const findings = AUTH_PAGES.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return BANNED_VOSEO_WORDS.flatMap((word) =>
        containsWholeWord(source, word) ? [`${file}: ${word}`] : [],
      );
    });

    expect(findings).toEqual([]);
  });

  it('uses the tuteo forms for key login and register texts', () => {
    const loginSource = readFileSync('src/app/login/page.tsx', 'utf8');
    const registerSource = readFileSync('src/app/register/page.tsx', 'utf8');

    expect(loginSource).toContain('Ingresa tus credenciales');
    expect(loginSource).toContain('o continúa con');
    expect(loginSource).toContain('¿No tienes una cuenta?');
    expect(loginSource).toContain('Regístrate aquí');
    expect(loginSource).toContain('Por favor, verifica tu email y contraseña');

    expect(registerSource).toContain('Completa los datos para comenzar');
    expect(registerSource).toContain('Repite tu contraseña');
    expect(registerSource).toContain('¿Ya tienes una cuenta?');
    expect(registerSource).toContain('Inicia sesión aquí');
  });
});
