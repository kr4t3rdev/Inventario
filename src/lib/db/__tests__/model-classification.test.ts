/**
 * @description Contrato de clasificación de modelos por scope tenant (AS-01 T2).
 * Todo modelo del schema Prisma debe estar clasificado como scoped, global,
 * child o pending-scope. Un modelo nuevo sin clasificar rompe CI.
 * @module src/lib/db/__tests__/model-classification.test
 */
import { describe, expect, it } from 'vitest';
import { Prisma } from '@/generated/prisma';
import {
  MODEL_CLASSIFICATION,
  MODEL_SCOPE_KINDS,
  getModelScope,
  type ModelScopeKind,
} from '@/lib/db/model-classification';

describe('AS-01 contrato de clasificación de modelos', () => {
  it('todo modelo del schema está clasificado (sin faltantes ni sobrantes)', () => {
    const dmmfModels = Prisma.dmmf.datamodel.models.map((m) => m.name).sort();
    const classified = Object.keys(MODEL_CLASSIFICATION).sort();

    const missing = dmmfModels.filter((m) => !(m in MODEL_CLASSIFICATION));
    const stale = classified.filter((m) => !dmmfModels.includes(m));

    expect(
      missing,
      `Modelos sin clasificar (añadir a MODEL_CLASSIFICATION):\n${missing.join('\n')}`,
    ).toEqual([]);
    expect(
      stale,
      `Modelos clasificados que ya no existen en el schema:\n${stale.join('\n')}`,
    ).toEqual([]);
  });

  it('todo scope usa un kind válido con justificación escrita', () => {
    const valid: ReadonlySet<string> = new Set(MODEL_SCOPE_KINDS);
    for (const [model, entry] of Object.entries(MODEL_CLASSIFICATION)) {
      expect(valid.has(entry.scope), `${model}: scope inválido ${entry.scope}`).toBe(true);
      expect(entry.reason.trim().length, `${model}: falta justificación`).toBeGreaterThan(0);
    }
  });

  it('los modelos scoped tienen columna tenantId real en el DMMF', () => {
    const byName = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));
    const offenders: string[] = [];
    for (const [model, entry] of Object.entries(MODEL_CLASSIFICATION)) {
      if (entry.scope !== 'scoped') continue;
      const dmmf = byName.get(model);
      const hasTenantId = dmmf?.fields.some((f) => f.name === 'tenantId') ?? false;
      if (!hasTenantId) offenders.push(model);
    }
    expect(offenders, `Marcados scoped sin columna tenantId:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('clasifica las conversiones de unidad como datos scoped del tenant', () => {
    const conversion = Prisma.dmmf.datamodel.models.find(
      (model) => model.name === 'UnidadConversion',
    );

    expect(conversion?.fields.map((field) => field.name)).toEqual(
      expect.arrayContaining(['tenantId', 'productoId', 'baseUnidadId', 'unidadId']),
    );
    const relationFields = Object.fromEntries(
      conversion?.fields
        .filter((field) => field.kind === 'object')
        .map((field) => [field.name, field.relationFromFields]) ?? [],
    );

    expect(relationFields.producto).toEqual(['tenantId', 'productoId', 'baseUnidadId']);
    expect(relationFields.unidad).toEqual(['tenantId', 'unidadId']);
    expect(getModelScope('UnidadConversion')).toBe('scoped');
    expect(MODEL_CLASSIFICATION.UnidadConversion.reason).toContain('mismo tenant');
  });

  it('los modelos child declaran padre y campo de resolución', () => {
    for (const [model, entry] of Object.entries(MODEL_CLASSIFICATION)) {
      if (entry.scope !== 'child') continue;
      expect(entry.parentModel, `${model}: child sin parentModel`).toBeTruthy();
      expect(entry.parentField, `${model}: child sin parentField`).toBeTruthy();
      expect(
        MODEL_CLASSIFICATION[entry.parentModel as string],
        `${model}: padre desconocido ${entry.parentModel}`,
      ).toBeTruthy();
    }
  });

  it('getModelScope resuelve los kinds esperados en casos representativos', () => {
    const expectations: Array<[string, ModelScopeKind]> = [
      ['Venta', 'scoped'],
      ['Contrato', 'scoped'],
      ['TenantMembership', 'scoped'],
      ['TenantRole', 'scoped'],
      ['Tenant', 'global'],
      ['User', 'global'],
      ['Plan', 'global'],
      ['Moneda', 'global'],
      ['TasaCambio', 'global'],
      ['VentaItem', 'child'],
      ['OfertaItem', 'child'],
      ['ContratoVersion', 'child'],
      ['ReciboOrdenReparacion', 'child'],
      ['AnticipoMovimiento', 'child'],
      ['TransaccionMoneda', 'scoped'],
      ['AlertHistory', 'scoped'],
      ['InyeccionCapital', 'scoped'],
      ['PagoDeuda', 'scoped'],
      ['SaldoSnapshot', 'scoped'],
      ['Asiento', 'scoped'],
      ['AsientoLinea', 'scoped'],
      ['CashPaymentInterestAllocation', 'scoped'],
      ['CuentaContable', 'scoped'],
      ['CuentaRolTenant', 'scoped'],
      ['Diario', 'scoped'],
      ['PlantillaAsiento', 'global'],
      ['ReplayApproval', 'scoped'],
      ['ReplayPreflight', 'scoped'],
      ['ReplayRun', 'scoped'],
      ['ShadowPosteoOutbox', 'scoped'],
      ['TipoContratoCustom', 'scoped'],
    ];
    for (const [model, scope] of expectations) {
      expect(getModelScope(model), model).toBe(scope);
    }
  });
});
