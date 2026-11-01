import { describe, expect, it } from 'vitest';
import {
  PLAN_BASICO_FEATURES,
  PLAN_EMPRESARIAL_FEATURES,
  PLAN_PROFESIONAL_FEATURES,
} from '../../../../prisma/seed/plans-seed';
import { FEATURE_REGISTRY } from '../feature-registry';

describe('Capa formal contable global', () => {
  it('declara la feature en el registro central', () => {
    expect(FEATURE_REGISTRY).toContainEqual(
      expect.objectContaining({ key: 'contabilidad-formal' }),
    );
  });

  it('habilita la capa formal en los tres planes (semilla y planes existentes via migracion)', () => {
    expect(PLAN_BASICO_FEATURES['contabilidad-formal']).toBe(true);
    // Profesional y Empresarial heredan via spread de Básico.
    expect(PLAN_PROFESIONAL_FEATURES['contabilidad-formal']).toBe(true);
    expect(PLAN_EMPRESARIAL_FEATURES['contabilidad-formal']).toBe(true);
  });

  it('propaga la activacion a planes ya creados (migracion idempotente presente)', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const ruta = join(
      process.cwd(),
      'prisma/migrations/20261102000000_contabilidad_formal_planes/migration.sql',
    );
    const sql = readFileSync(ruta, 'utf8');
    expect(sql).toContain('"contabilidad-formal": true');
    expect(sql).toContain("jsonb_typeof(\"features\") = 'object'");
  });
});
