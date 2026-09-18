/**
 * @description Tests de las métricas de provisioning de política contable.
 *              Verifican contadores de baja cardinalidad y el gauge operacional;
 *              ninguna etiqueta expone tenantId, actor ni moneda.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  accountingPolicyPreflightCounter,
  accountingPolicyProvisioningCounter,
  accountingPolicyRolloutEntriesCounter,
  operationalTenantsWithoutAccountingPolicyGauge,
  refreshOperationalTenantsWithoutAccountingPolicy,
  recordAccountingPolicyProvisioningCommitted,
  metricsRegistry,
} from './metrics';

describe('accounting policy metrics', () => {
  beforeEach(() => {
    accountingPolicyPreflightCounter.reset();
    accountingPolicyProvisioningCounter.reset();
    accountingPolicyRolloutEntriesCounter.reset();
    operationalTenantsWithoutAccountingPolicyGauge.reset();
  });

  it('cuenta preflight por clasificación sin etiquetas sensibles', async () => {
    accountingPolicyPreflightCounter.inc({ classification: 'MISSING_NO_EVIDENCE' });
    accountingPolicyPreflightCounter.inc({ classification: 'MISSING_NO_EVIDENCE' });
    accountingPolicyPreflightCounter.inc({ classification: 'REVIEW_REQUIRED' });

    const value = await accountingPolicyPreflightCounter.get();
    expect(value.values).toEqual(expect.arrayContaining([
      expect.objectContaining({
        value: 2,
        labels: { classification: 'MISSING_NO_EVIDENCE' },
      }),
      expect.objectContaining({
        value: 1,
        labels: { classification: 'REVIEW_REQUIRED' },
      }),
    ]));

    const metric = metricsRegistry.getSingleMetric('accounting_policy_preflight_total');
    expect(metric).toBeDefined();
  });

  it('cuenta provisioning por origen y resultado', async () => {
    accountingPolicyProvisioningCounter.inc({ origin: 'ONBOARDING', result: 'CREATED' });
    accountingPolicyProvisioningCounter.inc({ origin: 'ROLLOUT', result: 'NO_OP' });

    const value = await accountingPolicyProvisioningCounter.get();
    expect(value.values).toHaveLength(2);
    const metric = metricsRegistry.getSingleMetric('accounting_policy_provisioning_total');
    expect(metric).toBeDefined();
  });

  it('cuenta entradas de rollout por resultado final', async () => {
    accountingPolicyRolloutEntriesCounter.inc({ result: 'CREATED' });
    accountingPolicyRolloutEntriesCounter.inc({ result: 'FAILED' });

    const value = await accountingPolicyRolloutEntriesCounter.get();
    expect(value.values).toHaveLength(2);
    const metric = metricsRegistry.getSingleMetric('accounting_policy_rollout_entries_total');
    expect(metric).toBeDefined();
  });

  it('expone el gauge operacional de tenants activos sin política', async () => {
    operationalTenantsWithoutAccountingPolicyGauge.set(3);

    const value = await operationalTenantsWithoutAccountingPolicyGauge.get();
    expect(value.values[0]?.value).toBe(3);
    const metric = metricsRegistry.getSingleMetric(
      'operational_tenants_without_accounting_policy',
    );
    expect(metric).toBeDefined();
  });

  it('actualiza el gauge desde tenants operativos server-side y no desde el caller', async () => {
    const client = {
      tenantLicense: { count: vi.fn().mockResolvedValue(4) },
    };

    await expect(refreshOperationalTenantsWithoutAccountingPolicy(client)).resolves.toBe(4);
    expect(client.tenantLicense.count).toHaveBeenCalledWith({
      where: {
        activa: true,
        expiracion: { gt: expect.any(Date) },
        tenant: { accountingPolicy: null },
      },
    });
    const value = await operationalTenantsWithoutAccountingPolicyGauge.get();
    expect(value.values[0]?.value).toBe(4);
  });

  it('no define etiquetas de tenant, actor ni moneda en ninguna métrica nueva', () => {
    expect(accountingPolicyPreflightCounter.labelNames.sort()).toEqual(['classification']);
    expect(accountingPolicyProvisioningCounter.labelNames.sort()).toEqual(['origin', 'result']);
    expect(accountingPolicyRolloutEntriesCounter.labelNames).toEqual(['result']);
    expect(
      operationalTenantsWithoutAccountingPolicyGauge.labelNames,
    ).toEqual([]);
  });

  it('registra provisioning solo cuando el caller confirma el commit exterior', async () => {
    recordAccountingPolicyProvisioningCommitted('ONBOARDING', 'CREATED');

    const value = await accountingPolicyProvisioningCounter.get();

    expect(value.values).toEqual([
      expect.objectContaining({
        value: 1,
        labels: { origin: 'ONBOARDING', result: 'CREATED' },
      }),
    ]);
  });
});
