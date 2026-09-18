import { describe, expect, it } from 'vitest';

import { resolveLicenseDurationDays } from '../license-duration';

describe('resolveLicenseDurationDays', () => {
  it('usa la duración del plan cuando no hay override', () => {
    expect(resolveLicenseDurationDays(30)).toBe(30);
  });

  it('prioriza el override explícito sobre la duración del plan', () => {
    expect(resolveLicenseDurationDays(30, 45)).toBe(45);
  });

  it('retorna undefined solo si plan y override son indefinidos', () => {
    expect(resolveLicenseDurationDays(undefined)).toBeUndefined();
  });

  it('rechaza override cero o negativo', () => {
    expect(() => resolveLicenseDurationDays(30, 0)).toThrowError(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
    expect(() => resolveLicenseDurationDays(30, -5)).toThrowError(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });

  it('rechaza override no entero', () => {
    expect(() => resolveLicenseDurationDays(30, 1.5)).toThrowError(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });

  it('rechaza una duración de plan inválida', () => {
    expect(() => resolveLicenseDurationDays(0)).toThrowError(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });
});
