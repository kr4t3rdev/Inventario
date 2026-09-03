/**
 * @description Tests de formatCurrency con moneda opcional (módulo servicios).
 */
import { describe, expect, it } from 'vitest';
import { formatCurrency } from '@/lib/utils';

describe('formatCurrency', () => {
  it('formatea en CUP por defecto (retrocompatible)', () => {
    const result = formatCurrency(1000);
    expect(result).toContain('CUP');
    expect(result).toBe(formatCurrency(1000, 'CUP'));
  });

  it('respeta la moneda recibida', () => {
    const result = formatCurrency(1000, 'USD');
    expect(result).toContain('US');
    expect(result).not.toContain('CUP');
    expect(result).not.toBe(formatCurrency(1000));
  });

  it('no lanza con MLC (código no ISO soportado por el sistema)', () => {
    expect(() => formatCurrency(1000, 'MLC')).not.toThrow();
  });
});
