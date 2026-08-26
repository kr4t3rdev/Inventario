import {
  classifyAccountingPolicyEvidence,
  type AccountingEvidenceClient,
} from '@/features/contabilidad/services/accounting-policy-evidence-service';
import { canRunAccountingPolicyRollout } from '@/lib/auth/accounting-policy-capabilities';
import { refreshOperationalTenantsWithoutAccountingPolicy } from '@/lib/metrics';
import { prisma } from '@/lib/prisma';
import { ActionError } from '@/lib/server-actions';

export type AccountingPolicyPreflightClassification =
  | 'POLICY_PRESENT'
  | 'MISSING_NO_EVIDENCE'
  | 'MISSING_WITH_EVIDENCE'
  | 'REVIEW_REQUIRED';

interface PolicyDelegate {
  findUnique(args: {
    where: { tenantId: string };
    select: { tenantId: true; functionalCurrencyCode: true };
  }): Promise<{ tenantId: string; functionalCurrencyCode: string } | null>;
}

export interface AccountingPolicyPreflightClient extends AccountingEvidenceClient {
  tenantAccountingPolicy: PolicyDelegate;
}

export interface AccountingPolicyPreflightEntry {
  tenantId: string;
  classification: AccountingPolicyPreflightClassification;
  existingCurrencyCode?: string;
}

export interface AccountingPolicyPreflightSummary {
  inspected: number;
  policyPresent: number;
  missingNoEvidence: number;
  missingWithEvidence: number;
  reviewRequired: number;
}

export interface AccountingPolicyPreflightResult {
  entries: AccountingPolicyPreflightEntry[];
  summary: AccountingPolicyPreflightSummary;
}

interface AccountingPolicyPreflightOptions {
  batchSize?: number;
}

/**
 * @description Proyecta el estado de una política sin realizar mutaciones.
 * @param {AccountingPolicyPreflightClient} client - Cliente Prisma de solo lectura.
 * @param {string} tenantId - Tenant exacto que se inspeccionará.
 * @returns {Promise<AccountingPolicyPreflightEntry>} Clasificación segura del tenant.
 */
export async function classifyTenantAccountingPolicyState(
  client: AccountingPolicyPreflightClient,
  tenantId: string,
): Promise<AccountingPolicyPreflightEntry> {
  const policy = await client.tenantAccountingPolicy.findUnique({
    where: { tenantId },
    select: { tenantId: true, functionalCurrencyCode: true },
  });
  if (policy) {
    return {
      tenantId,
      classification: 'POLICY_PRESENT',
      existingCurrencyCode: policy.functionalCurrencyCode,
    };
  }

  const evidence = await classifyAccountingPolicyEvidence(client, tenantId);
  const classificationByEvidence = {
    NONE: 'MISSING_NO_EVIDENCE',
    PRESENT: 'MISSING_WITH_EVIDENCE',
    REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  } as const;

  return {
    tenantId,
    classification: classificationByEvidence[evidence.classification],
  };
}

/**
 * @description Inspecciona un scope explícito, deduplicado y produce totales conciliados.
 * @param {AccountingPolicyPreflightClient} client - Cliente Prisma de solo lectura.
 * @param {string[]} tenantIds - Identificadores autorizados por el caller.
 * @param {AccountingPolicyPreflightOptions} options - Límite de concurrencia por lote.
 * @returns {Promise<AccountingPolicyPreflightResult>} Entradas únicas y resumen.
 */
export async function preflightTenantAccountingPolicies(
  client: AccountingPolicyPreflightClient,
  tenantIds: string[],
  options: AccountingPolicyPreflightOptions = {},
): Promise<AccountingPolicyPreflightResult> {
  const uniqueTenantIds = [...new Set(tenantIds)];
  const batchSize = Math.min(Math.max(options.batchSize ?? 25, 1), 100);
  const entries: AccountingPolicyPreflightEntry[] = [];
  for (let index = 0; index < uniqueTenantIds.length; index += batchSize) {
    const batch = uniqueTenantIds.slice(index, index + batchSize);
    entries.push(...await Promise.all(
      batch.map((tenantId) => classifyTenantAccountingPolicyState(client, tenantId)),
    ));
  }

  return {
    entries,
    summary: {
      inspected: entries.length,
      policyPresent: entries.filter((entry) => entry.classification === 'POLICY_PRESENT').length,
      missingNoEvidence: entries.filter(
        (entry) => entry.classification === 'MISSING_NO_EVIDENCE',
      ).length,
      missingWithEvidence: entries.filter(
        (entry) => entry.classification === 'MISSING_WITH_EVIDENCE',
      ).length,
      reviewRequired: entries.filter(
        (entry) => entry.classification === 'REVIEW_REQUIRED',
      ).length,
    },
  };
}

/**
 * @description Ejecuta un preflight cross-tenant solo para un operador autorizado.
 * @param {string} actorUserId - Identidad activa del operador de plataforma.
 * @param {string[]} tenantIds - Scope explícito que se inspeccionará.
 * @returns {Promise<AccountingPolicyPreflightResult>} Resultado de solo lectura.
 */
export async function preflightAccountingPoliciesForRollout(
  actorUserId: string,
  tenantIds: string[],
): Promise<AccountingPolicyPreflightResult> {
  if (!await canRunAccountingPolicyRollout(actorUserId)) {
    throw new ActionError('Acceso restringido', 'FORBIDDEN');
  }

  const result = await preflightTenantAccountingPolicies(
    prisma as unknown as AccountingPolicyPreflightClient,
    tenantIds,
  );
  await refreshOperationalTenantsWithoutAccountingPolicy(prisma);
  return result;
}
