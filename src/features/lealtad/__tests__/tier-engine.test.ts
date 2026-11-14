/**
 * @description Tests unitarios para el motor de tiers.
 */
import { describe, it, expect } from 'vitest';
import { determinarTier, ascensoTier } from '@/features/lealtad/services/tier-engine';
import type { TierInfo } from '@/features/lealtad/services/tier-engine';

const tiersMock: TierInfo[] = [
  { nombre: 'Bronce', orden: 1, umbralGasto: 0, umbralFrecuencia: null, activo: true },
  { nombre: 'Plata', orden: 2, umbralGasto: 50000, umbralFrecuencia: 3, activo: true },
  { nombre: 'Oro', orden: 3, umbralGasto: 100000, umbralFrecuencia: 5, activo: true },
  { nombre: 'VIP', orden: 4, umbralGasto: 500000, umbralFrecuencia: 20, activo: true },
];

describe('determinarTier', () => {
  it('retorna Bronce si no cumple ningún umbral superior', () => {
    const resultado = determinarTier({
      gastoAnual: 10000,
      frecuenciaAnual: 1,
      tiers: tiersMock,
    });
    expect(resultado?.nombre).toBe('Bronce');
  });

  it('retorna Plata al cumplir gasto y frecuencia', () => {
    const resultado = determinarTier({
      gastoAnual: 60000,
      frecuenciaAnual: 4,
      tiers: tiersMock,
    });
    expect(resultado?.nombre).toBe('Plata');
  });

  it('retorna Oro al cumplir umbral alto', () => {
    const resultado = determinarTier({
      gastoAnual: 150000,
      frecuenciaAnual: 6,
      tiers: tiersMock,
    });
    expect(resultado?.nombre).toBe('Oro');
  });

  it('ignora tiers inactivos', () => {
    const tiers = tiersMock.map((t) => (t.nombre === 'Oro' ? { ...t, activo: false } : t));
    const resultado = determinarTier({
      gastoAnual: 150000,
      frecuenciaAnual: 6,
      tiers,
    });
    expect(resultado?.nombre).toBe('Plata');
  });

  it('retorna null si no hay tiers activos', () => {
    const resultado = determinarTier({
      gastoAnual: 100000,
      frecuenciaAnual: 10,
      tiers: [],
    });
    expect(resultado).toBeNull();
  });

  it('rechaza si cumple gasto pero no frecuencia', () => {
    const resultado = determinarTier({
      gastoAnual: 60000,
      frecuenciaAnual: 1,
      tiers: tiersMock,
    });
    expect(resultado?.nombre).toBe('Bronce');
  });
});

describe('ascensoTier', () => {
  it('detecta ascenso desde null', () => {
    const resultado = ascensoTier({
      tierAnterior: null,
      nuevoTier: { nombre: 'Bronce', orden: 1, umbralGasto: 0, umbralFrecuencia: null, activo: true },
    });
    expect(resultado).toBe(true);
  });

  it('detecta ascenso entre tiers', () => {
    const resultado = ascensoTier({
      tierAnterior: 'Bronce',
      nuevoTier: { nombre: 'Plata', orden: 2, umbralGasto: 50000, umbralFrecuencia: 3, activo: true },
    });
    expect(resultado).toBe(true);
  });

  it('retorna false si no hay cambio', () => {
    const resultado = ascensoTier({
      tierAnterior: 'Plata',
      nuevoTier: { nombre: 'Plata', orden: 2, umbralGasto: 50000, umbralFrecuencia: 3, activo: true },
    });
    expect(resultado).toBe(false);
  });

  it('retorna false si el nuevo tier es null', () => {
    const resultado = ascensoTier({
      tierAnterior: 'Plata',
      nuevoTier: null,
    });
    expect(resultado).toBe(false);
  });
});
