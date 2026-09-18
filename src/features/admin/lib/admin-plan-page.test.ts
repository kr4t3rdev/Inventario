import { describe, expect, it } from 'vitest';

import {
  formatPlanPriceLabel,
  filterAdminPlans,
} from '@/features/admin/lib/admin-plan-page';

describe('admin-plan-page', () => {
  it('filtra planes por nombre y descripción ignorando mayúsculas', () => {
    const plans = [
      { nombre: 'Básico', descripcion: 'Ideal para comenzar' },
      { nombre: 'Profesional', descripcion: 'Incluye fotos de productos' },
      { nombre: 'Empresarial', descripcion: null },
    ];

    expect(filterAdminPlans(plans, 'fotos')).toEqual([plans[1]]);
    expect(filterAdminPlans(plans, 'bás')).toEqual([plans[0]]);
  });

  it('devuelve todos los planes si la búsqueda está vacía', () => {
    const plans = [{ nombre: 'Básico', descripcion: 'Ideal para comenzar' }];

    expect(filterAdminPlans(plans, '   ')).toEqual(plans);
  });

  it('muestra precio mensual solo para planes de 30 días', () => {
    expect(formatPlanPriceLabel(0, 30)).toBe('Gratis');
    expect(formatPlanPriceLabel(25, 30)).toBe('$25/mes');
  });

  it('muestra duración real cuando el plan no es mensual', () => {
    expect(formatPlanPriceLabel(25, 90)).toBe('$25/90 días');
    expect(formatPlanPriceLabel(100, 365)).toBe('$100/365 días');
  });
});
