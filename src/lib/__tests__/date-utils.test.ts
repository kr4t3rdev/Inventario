import { describe, expect, it } from 'vitest';

import { addDays, MS_PER_DAY } from '../date-utils';

describe('addDays', () => {
  it('suma días a una fecha base sin mutarla', () => {
    const base = new Date('2026-08-06T12:00:00Z');
    const result = addDays(base, 30);

    expect(result.getTime()).toBe(base.getTime() + 30 * MS_PER_DAY);
    expect(base.getTime()).toBe(new Date('2026-08-06T12:00:00Z').getTime());
  });

  it('soporta días negativos', () => {
    const base = new Date('2026-08-06T12:00:00Z');
    expect(addDays(base, -5).getTime()).toBe(base.getTime() - 5 * MS_PER_DAY);
  });
});
