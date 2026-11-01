import { describe, expect, it } from 'vitest';

import { addDays, MS_PER_DAY, toIsoString, toIsoStringOrNull } from '../date-utils';

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

describe('toIsoString', () => {
  it('normaliza un Date a ISO', () => {
    expect(toIsoString(new Date('2026-09-14T10:00:00.000Z'))).toBe('2026-09-14T10:00:00.000Z');
  });

  it('normaliza un string ISO sin alterarlo', () => {
    expect(toIsoString('2026-09-14T10:00:00.000Z')).toBe('2026-09-14T10:00:00.000Z');
  });

  it('devuelve el string original cuando no es parseable', () => {
    expect(toIsoString('no-es-una-fecha')).toBe('no-es-una-fecha');
  });
});

describe('toIsoStringOrNull', () => {
  it('devuelve null para valores ausentes', () => {
    expect(toIsoStringOrNull(null)).toBeNull();
    expect(toIsoStringOrNull(undefined)).toBeNull();
  });

  it('normaliza un Date a ISO', () => {
    expect(toIsoStringOrNull(new Date('2026-09-14T10:00:00.000Z'))).toBe(
      '2026-09-14T10:00:00.000Z',
    );
  });
});
