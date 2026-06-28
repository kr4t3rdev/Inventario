import { describe, expect, it } from 'vitest';

import {
  isBasicPlanName,
  shouldHideBasicAccountingItem,
  shouldHideSeparateEmployeeModules,
} from '@/lib/plan-access';

describe('plan-access', () => {
  it('detecta el plan Básico por nombre', () => {
    expect(isBasicPlanName('Básico')).toBe(true);
    expect(isBasicPlanName('Profesional')).toBe(false);
    expect(isBasicPlanName(undefined)).toBe(false);
  });

  it('oculta módulos separados de RRHH para Básico', () => {
    expect(
      shouldHideSeparateEmployeeModules({
        planName: 'Básico',
        planFeatures: { empleados: true, nomina: true, asistencia: true, vacaciones: true },
      }),
    ).toBe(true);
  });

  it('no oculta módulos separados para planes no básicos', () => {
    expect(
      shouldHideSeparateEmployeeModules({
        planName: 'Empresarial',
        planFeatures: { empleados: true, nomina: true, asistencia: true, vacaciones: true },
      }),
    ).toBe(false);
  });

  it('mantiene visibles los reportes contables en Básico', () => {
    expect(
      shouldHideBasicAccountingItem(
        {
          planName: 'Básico',
          planFeatures: { contabilidad: true, 'reportes-financieros': true },
        },
        'Reportes Contables',
      ),
    ).toBe(false);
  });
});
