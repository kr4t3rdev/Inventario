import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { HERO_BADGES, HERO_DEFINITION } from '@/features/landing/data';

describe('landing hero copy', () => {
	const heroSource = readFileSync('src/features/landing/components/hero.tsx', 'utf8');

	it('keeps the commercial CTA hierarchy and direct POS demo access', () => {
		expect(heroSource).toContain('Empezar ahora');
		expect(heroSource).toContain('Ver planes');
		expect(heroSource).toContain('Ver demo POS');
		expect(heroSource).toContain('href="#demo-pos"');
	});

  it('starts with a standalone product definition', () => {
    const wordCount = HERO_DEFINITION.split(/\s+/).length;

    expect(HERO_DEFINITION.startsWith('FinanceMDM es')).toBe(true);
    expect(wordCount).toBeGreaterThanOrEqual(25);
    expect(wordCount).toBeLessThanOrEqual(50);
  });

  it('avoids unsupported numeric claims in floating badges', () => {
    expect(HERO_BADGES.map((badge) => badge.value)).toEqual([
      'Flujos conectados',
      'Menos tareas manuales',
      'Visión en tiempo real',
    ]);
  });
});
