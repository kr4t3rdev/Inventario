import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const files = [
  'src/features/landing/data.ts',
  'src/features/reviews/components/pricing-dynamic.tsx',
  'src/features/landing/components/pos-demo/pos-demo-section.tsx',
  'src/features/landing/components/footer.tsx',
];

const readLandingCopy = () => files.map((path) => readFileSync(path, 'utf8')).join('\n');

describe('landing phase 4 copy contracts', () => {
  it('mantiene el copy visible en español y evita residuos ingleses', () => {
    const pricing = readFileSync(files[1], 'utf8');
    const pos = readFileSync(files[2], 'utf8');
    const data = readFileSync(files[0], 'utf8');

    expect(pricing).not.toContain('users');
    expect(pos).not.toContain('mockeados');
    expect(pos).not.toContain('Sin login');
    expect(pos).toContain('interfaz');
    expect(pos).toContain('datos de demostración');
    expect(pos).not.toContain('arranca con seed real');
    expect(pricing).toContain('usuarios');
  });

  it('mantiene los CTAs comerciales canónicos', () => {
    const copy = readLandingCopy();

    expect(copy).toContain('Iniciar sesión');
    expect(copy).toContain('Registrarse');
    expect(copy).toContain('Ver demo POS');
    expect(copy).toContain('Ver planes');
  });
});
