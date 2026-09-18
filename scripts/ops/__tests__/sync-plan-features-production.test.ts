import { describe, expect, it } from 'vitest';

import { getCanonicalPlanFeatures } from '../sync-plan-features-production';

describe('getCanonicalPlanFeatures', () => {
  it('mantiene Básico sin nómina, asistencia ni vacaciones', () => {
    const features = getCanonicalPlanFeatures();

    expect(features['Básico'].nomina).toBe(false);
    expect(features['Básico'].asistencia).toBe(false);
    expect(features['Básico'].vacaciones).toBe(false);
  });

  it('incluye los upload flags canónicos', () => {
    const features = getCanonicalPlanFeatures();

    expect(features['Básico']['upload-mi-empresa-logo']).toBe(true);
    expect(features.Profesional['upload-clientes-logo']).toBe(true);
    expect(features.Empresarial['upload-productos-photo']).toBe(true);
  });
});
