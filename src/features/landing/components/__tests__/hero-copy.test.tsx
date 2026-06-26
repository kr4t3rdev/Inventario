import { describe, expect, it } from 'vitest';

import { HERO_BADGES, HERO_DEFINITION } from '@/features/landing/data';

describe('landing hero copy', () => {
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
