import { describe, expect, it } from 'vitest';

import {
  canAccessAccountingItem,
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

  it('mantiene visibles períodos, logs y balance cuando el plan real los habilita', () => {
    const basicUser = {
      planName: 'Básico',
      planFeatures: { contabilidad: true, 'reportes-financieros': true },
    };

    expect(shouldHideBasicAccountingItem(basicUser, 'Períodos Contables')).toBe(false);
    expect(shouldHideBasicAccountingItem(basicUser, 'Logs')).toBe(false);
    expect(shouldHideBasicAccountingItem(basicUser, 'Balance y Resultados')).toBe(false);
  });

  it('oculta ajustes bancarios en Básico mientras no exista feature explícito', () => {
    const basicUser = {
      planName: 'Básico',
      planFeatures: { contabilidad: true },
    };

    expect(shouldHideBasicAccountingItem(basicUser, 'Ajustes Bancarios')).toBe(true);
    expect(canAccessAccountingItem(basicUser, 'Ajustes Bancarios')).toBe(false);
  });

  it('permite transferencias y ajustes con feature explícito', () => {
    const professionalUser = {
      planName: 'Profesional',
      planFeatures: {
        contabilidad: true,
        'transferencias-bancarias': true,
        'ajustes-bancarios': true,
      },
    };

    expect(canAccessAccountingItem(professionalUser, 'Transferencias Bancarias')).toBe(true);
    expect(canAccessAccountingItem(professionalUser, 'Ajustes Bancarios')).toBe(true);
  });
});
