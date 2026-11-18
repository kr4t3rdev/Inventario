import { describe, expect, it } from 'vitest';
import { resolveCutoffPeriod } from './initialization-period';

describe('período mensual de la fecha de corte', () => {
  it('resuelve noviembre 2026 del 1 al 30', () => {
    const result = resolveCutoffPeriod('2026-11-01');
    expect(result.tipo).toBe('MENSUAL');
    expect(result.fechaInicio.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(result.fechaFin.toISOString()).toBe('2026-11-30T00:00:00.000Z');
  });

  it('resuelve febrero no bisiesto del 1 al 28', () => {
    const result = resolveCutoffPeriod('2026-02-15');
    expect(result.fechaInicio.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(result.fechaFin.toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });

  it('resuelve febrero bisiesto del 1 al 29', () => {
    const result = resolveCutoffPeriod('2024-02-15');
    expect(result.fechaFin.toISOString()).toBe('2024-02-29T00:00:00.000Z');
  });

  it('resuelve diciembre del 1 al 31', () => {
    const result = resolveCutoffPeriod('2026-12-31');
    expect(result.fechaInicio.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(result.fechaFin.toISOString()).toBe('2026-12-31T00:00:00.000Z');
  });

  it('rechaza fechas inválidas', () => {
    expect(() => resolveCutoffPeriod('2026-13-01')).toThrow();
    expect(() => resolveCutoffPeriod('2026-02-30')).toThrow();
    expect(() => resolveCutoffPeriod('no-es-fecha')).toThrow();
  });
});
