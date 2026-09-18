/**
 * @description Tests de contrato de persistencia operacional del provisioning de
 *              `TenantAccountingPolicy`. Verifican vía DMMF que el esquema expone
 *              los modelos de rollout/aprobaciones y la moneda pendiente de alta,
 *              con las unicidades y límites exigidos por el diseño, y que ninguna
 *              columna deriva de `Moneda.esPrincipal`.
 */
import { describe, expect, it } from 'vitest';

import { Prisma } from '@/generated/prisma';

function getModel(modelName: string) {
  const model = Prisma.dmmf.datamodel.models.find((candidate) => candidate.name === modelName);
  expect(model, `El modelo ${modelName} debe existir en el esquema`).toBeDefined();
  return model!;
}

describe('accounting policy rollout schema', () => {
  it('define el run durable con modo, hash de manifiesto y resumen conciliado', () => {
    const run = getModel('AccountingPolicyRolloutRun');
    const fieldNames = run.fields.map((field) => field.name);
    for (const required of [
      'mode',
      'manifestHash',
      'status',
      'executorUserId',
      'approverUserId',
      'reason',
      'summary',
    ]) {
      expect(fieldNames).toContain(required);
    }
  });

  it('exige una entrada única por (runId, tenantId) para reanudación durable', () => {
    const entry = getModel('AccountingPolicyRolloutEntry');
    const uniqueConstraints = entry.uniqueIndexes.map((uniqueIndex) =>
      [...uniqueIndex.fields].sort(),
    );
    expect(uniqueConstraints).toContainEqual(['runId', 'tenantId']);
    expect(entry.fields.map((field) => field.name)).toContain('safeError');
  });

  it('vincula cada aprobación tenant a una moneda exacta con consumo y expiración', () => {
    const approval = getModel('AccountingPolicyTenantApproval');
    const uniqueConstraints = approval.uniqueIndexes.map((uniqueIndex) =>
      [...uniqueIndex.fields].sort(),
    );
    expect(uniqueConstraints).toContainEqual([
      'approvalHash',
      'functionalCurrencyCode',
      'tenantId',
    ]);
    const fieldNames = approval.fields.map((field) => field.name);
    for (const required of ['status', 'expiresAt', 'consumedAt', 'actorUserId', 'reason']) {
      expect(fieldNames).toContain(required);
    }
  });

  it('conserva la moneda pendiente de alta como nullable sin default derivado', () => {
    const user = getModel('User');
    const pendingCurrency = user.fields.find(
      (field) => field.name === 'pendingFunctionalCurrencyCode',
    );
    expect(pendingCurrency).toBeDefined();
    expect(pendingCurrency!.isRequired).toBe(false);
    expect(pendingCurrency!.default).toBeUndefined();
  });

  it('no introduce columnas ni defaults derivados de esPrincipal en la política', () => {
    const policy = getModel('TenantAccountingPolicy');
    const derivedFields = policy.fields.filter((field) =>
      /esPrincipal|isPrimary/i.test(field.name)
      || JSON.stringify(field.default ?? '').includes('esPrincipal'),
    );
    expect(derivedFields).toEqual([]);
  });
});
