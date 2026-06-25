import { describe, expect, it } from 'vitest';

import { PLAN_BASICO_FEATURES } from '../../seed/plans-seed';

describe('PLAN_BASICO_FEATURES', () => {
  it('mantiene gestión de empleados activa en Básico', () => {
    expect(PLAN_BASICO_FEATURES.empleados).toBe(true);
  });

  it('oculta módulos separados de nómina, asistencia y vacaciones en Básico', () => {
    expect(PLAN_BASICO_FEATURES.nomina).toBe(false);
    expect(PLAN_BASICO_FEATURES.asistencia).toBe(false);
    expect(PLAN_BASICO_FEATURES.vacaciones).toBe(false);
  });
});
