import type { Prisma } from '@/generated/prisma';
import type {
  EvidenceClassification,
  ProvisionAccountingPolicyInput,
  ProvisioningResult,
} from '@/features/contabilidad/types/accounting-policy';
import { prisma } from '@/lib/prisma';
import { AuditLogService } from '@/lib/services/audit-log-service';
import {
  recordAccountingPolicyProvisioningCommitted,
  refreshOperationalTenantsWithoutAccountingPolicy,
} from '@/lib/metrics';

import {
  classifyAccountingPolicyEvidence,
  type AccountingEvidenceClient,
} from './accounting-policy-evidence-service';
import { acquireAccountingTenantLock } from './accounting-tenant-lock-service';

export type PolicyErrorCode =
  | 'TENANT_ACCOUNTING_POLICY_REQUIRED'
  | 'FUNCTIONAL_CURRENCY_NOT_AVAILABLE'
  | 'FUNCTIONAL_CURRENCY_IMMUTABLE'
  | 'ACCOUNTING_POLICY_CONFLICT'
  | 'ACCOUNTING_POLICY_FORBIDDEN'
  | 'ACCOUNTING_AUDIT_UNAVAILABLE';

export interface ProvisionAccountingPolicyResult {
  result: ProvisioningResult;
  functionalCurrencyCode: string;
  existingCurrencyCode: string | null;
  evidence: EvidenceClassification;
}

/** Error esperado al resolver o modificar la política contable de un tenant. */
export class TenantAccountingPolicyError extends Error {
  /**
   * @description Construye un error tipado de política contable.
   * @param {string} message - Mensaje seguro.
   * @param {PolicyErrorCode} code - Código estable del dominio.
   * @returns {TenantAccountingPolicyError} Error tipado.
   */
  constructor(
    message: string,
    public readonly code: PolicyErrorCode,
    public readonly auditResult?: ProvisionAccountingPolicyResult,
  ) {
    super(message);
    this.name = 'TenantAccountingPolicyError';
  }
}

/**
 * @description Obtiene la moneda funcional configurada explícitamente para un tenant.
 * @param {string} tenantId - Tenant propietario de la política.
 * @param {Prisma.TransactionClient} client - Cliente transaccional opcional.
 * @returns {Promise<object>} Política tenant-scoped.
 */
export async function getRequiredTenantAccountingPolicy(
  tenantId: string,
  client?: Prisma.TransactionClient,
) {
  const db = client ?? prisma;
  const policy = await db.tenantAccountingPolicy.findUnique({
    where: { tenantId },
    select: {
      tenantId: true,
      functionalCurrencyCode: true,
      createdAt: true,
      updatedAt: true,
      updatedBy: true,
    },
  });
  if (!policy) {
    throw new TenantAccountingPolicyError(
      'La empresa no tiene una moneda funcional contable configurada',
      'TENANT_ACCOUNTING_POLICY_REQUIRED',
    );
  }
  return policy;
}

/**
 * @description Registra el resultado de provisioning dentro de la misma transacción.
 * @param {Prisma.TransactionClient} tx - Transacción activa.
 * @param {ProvisionAccountingPolicyInput} input - Contexto completo de decisión.
 * @param {ProvisionAccountingPolicyResult} result - Resultado seguro del dominio.
 * @returns {Promise<void>} Finaliza solo cuando la auditoría es durable.
 */
async function auditProvisioningResult(
  tx: Prisma.TransactionClient,
  input: ProvisionAccountingPolicyInput,
  result: ProvisionAccountingPolicyResult,
): Promise<void> {
  await AuditLogService.logStrict({
    accion: result.result === 'UPDATED'
      ? 'UPDATE'
      : input.origin === 'ROLLOUT' ? 'EXECUTE' : 'CREATE',
    entidad: input.origin === 'ROLLOUT'
      ? 'ACCOUNTING_POLICY_ROLLOUT'
      : 'TENANT_ACCOUNTING_POLICY',
    entidadId: input.tenantId,
    usuarioId: input.actorUserId,
    detalles: {
      result: result.result,
      tenantId: input.tenantId,
      requestedCurrency: result.functionalCurrencyCode,
      existingCurrency: result.existingCurrencyCode,
      evidence: result.evidence,
      origin: input.origin,
      reason: input.reason,
      correlationId: input.correlationId,
      manifestHash: input.manifestHash ?? null,
      platformApproverUserId: input.platformApproverUserId ?? null,
      tenantApprovalId: input.tenantApprovalId ?? null,
    },
  }, tx);
}

/**
 * @description Provisiona una política bajo lock, evidencia canónica y auditoría estricta.
 * @param {Prisma.TransactionClient} tx - Transacción serializable ya abierta.
 * @param {ProvisionAccountingPolicyInput} input - Moneda explícita y contexto auditable.
 * @returns {Promise<ProvisionAccountingPolicyResult>} Resultado idempotente y determinista.
 */
export async function provisionTenantAccountingPolicyInTransaction(
  tx: Prisma.TransactionClient,
  input: ProvisionAccountingPolicyInput,
): Promise<ProvisionAccountingPolicyResult> {
  const currencyCode = input.functionalCurrencyCode.trim().toUpperCase();
  await acquireAccountingTenantLock(tx, input.tenantId);

  const currency = await tx.moneda.findFirst({
    where: { codigo: currencyCode, isActive: true },
    select: { codigo: true },
  });
  if (!currency) {
    const invalidResult: ProvisionAccountingPolicyResult = {
      result: 'BLOCKED',
      functionalCurrencyCode: currencyCode,
      existingCurrencyCode: null,
      evidence: 'REVIEW_REQUIRED',
    };
    throw new TenantAccountingPolicyError(
      'La moneda funcional seleccionada no está disponible',
      'FUNCTIONAL_CURRENCY_NOT_AVAILABLE',
      invalidResult,
    );
  }

  const existing = await tx.tenantAccountingPolicy.findUnique({
    where: { tenantId: input.tenantId },
    select: {
      tenantId: true,
      functionalCurrencyCode: true,
      createdAt: true,
      updatedAt: true,
      updatedBy: true,
    },
  });
  if (existing?.functionalCurrencyCode === currencyCode) {
    const result: ProvisionAccountingPolicyResult = {
      result: 'NO_OP',
      functionalCurrencyCode: currencyCode,
      existingCurrencyCode: currencyCode,
      evidence: 'NONE',
    };
    await auditProvisioningResult(tx, input, result);
    return result;
  }

  const evidence = await classifyAccountingPolicyEvidence(
    tx as unknown as AccountingEvidenceClient,
    input.tenantId,
  );
  if (input.expectedEvidence && input.expectedEvidence !== evidence.classification) {
    const result: ProvisionAccountingPolicyResult = {
      result: 'BLOCKED',
      functionalCurrencyCode: currencyCode,
      existingCurrencyCode: null,
      evidence: evidence.classification,
    };
    await auditProvisioningResult(tx, input, result);
    return result;
  }
  if (existing) {
    if (evidence.classification === 'NONE' && input.origin === 'TENANT_UI') {
      await tx.tenantAccountingPolicy.update({
        where: { tenantId: input.tenantId },
        data: { functionalCurrencyCode: currencyCode, updatedBy: input.actorUserId },
      });
      const result: ProvisionAccountingPolicyResult = {
        result: 'UPDATED',
        functionalCurrencyCode: currencyCode,
        existingCurrencyCode: existing.functionalCurrencyCode,
        evidence: evidence.classification,
      };
      await auditProvisioningResult(tx, input, result);
      return result;
    }

    const result: ProvisionAccountingPolicyResult = {
      result: evidence.classification === 'PRESENT' ? 'BLOCKED' : 'CONFLICT',
      functionalCurrencyCode: currencyCode,
      existingCurrencyCode: existing.functionalCurrencyCode,
      evidence: evidence.classification,
    };
    if (evidence.classification === 'PRESENT') {
      throw new TenantAccountingPolicyError(
        'La moneda funcional no puede cambiar después de registrar evidencia contable',
        'FUNCTIONAL_CURRENCY_IMMUTABLE',
        result,
      );
    }
    await auditProvisioningResult(tx, input, result);
    return result;
  }

  if (evidence.classification === 'REVIEW_REQUIRED') {
    const result: ProvisionAccountingPolicyResult = {
      result: 'BLOCKED',
      functionalCurrencyCode: currencyCode,
      existingCurrencyCode: null,
      evidence: evidence.classification,
    };
    await auditProvisioningResult(tx, input, result);
    return result;
  }

  if (evidence.classification === 'PRESENT') {
    const approval = input.tenantApprovalId
      ? await tx.accountingPolicyTenantApproval.findUnique({
          where: { approvalId: input.tenantApprovalId },
        })
      : null;
    const hasTripleControl = input.origin === 'ROLLOUT'
      && Boolean(input.platformApproverUserId)
      && input.platformApproverUserId !== input.actorUserId
      && approval?.tenantId === input.tenantId
      && approval.functionalCurrencyCode === currencyCode
      && approval.status === 'ACTIVE'
      && approval.expiresAt > new Date();
    if (!hasTripleControl) {
      const result: ProvisionAccountingPolicyResult = {
        result: 'BLOCKED',
        functionalCurrencyCode: currencyCode,
        existingCurrencyCode: null,
        evidence: evidence.classification,
      };
      await auditProvisioningResult(tx, input, result);
      return result;
    }
  }

  await tx.tenantAccountingPolicy.create({
    data: {
      tenantId: input.tenantId,
      functionalCurrencyCode: currencyCode,
      updatedBy: input.actorUserId,
    },
  });
  const result: ProvisionAccountingPolicyResult = {
    result: 'CREATED',
    functionalCurrencyCode: currencyCode,
    existingCurrencyCode: null,
    evidence: evidence.classification,
  };
  await auditProvisioningResult(tx, input, result);

  if (input.tenantApprovalId) {
    await tx.accountingPolicyTenantApproval.update({
      where: { approvalId: input.tenantApprovalId },
      data: { status: 'CONSUMED', consumedAt: new Date() },
    });
  }
  return result;
}

/**
 * @description Abre una transacción serializable y reintenta solo colisiones transitorias.
 * @param {ProvisionAccountingPolicyInput} input - Moneda y contexto explícitos.
 * @returns {Promise<ProvisionAccountingPolicyResult>} Resultado del provisioning.
 */
export async function provisionTenantAccountingPolicy(
  input: ProvisionAccountingPolicyInput,
): Promise<ProvisionAccountingPolicyResult> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let result: ProvisionAccountingPolicyResult;
    try {
      result = await prisma.$transaction(
        (tx) => provisionTenantAccountingPolicyInTransaction(tx, input),
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (['P2034', '40P01'].includes(code ?? '') && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 10));
        continue;
      }

      // A transaction can roll back after the domain result was computed, for
      // example if consuming a tenant approval or another transaction write
      // fails. Preserve a durable, safe decision for every rollback path.
      const auditResult = error instanceof TenantAccountingPolicyError && error.auditResult
        ? error.auditResult
        : {
            result: 'BLOCKED' as const,
            functionalCurrencyCode: input.functionalCurrencyCode.trim().toUpperCase(),
            existingCurrencyCode: null,
            evidence: 'REVIEW_REQUIRED' as const,
          };
      try {
        await auditProvisioningResult(prisma, input, auditResult);
      } catch {
        throw new TenantAccountingPolicyError(
          'No se pudo registrar la decisión contable de forma durable',
          'ACCOUNTING_AUDIT_UNAVAILABLE',
          auditResult,
        );
      }
      throw error;
    }

    try {
      recordAccountingPolicyProvisioningCommitted(input.origin, result.result);
    } catch (error) {
      console.error('No se pudo registrar la métrica de provisioning después del commit', {
        origin: input.origin,
        result: result.result,
        error: error instanceof Error ? error.message : 'Error de telemetría desconocido',
      });
    }
    try {
      await refreshOperationalTenantsWithoutAccountingPolicy();
    } catch (error) {
      console.error('No se pudo actualizar el gauge de tenants sin política después del commit', {
        origin: input.origin,
        result: result.result,
        error: error instanceof Error ? error.message : 'Error de telemetría desconocido',
      });
    }
    return result;
  }
  throw new Error('No se pudo completar el provisioning contable');
}

interface SetTenantAccountingPolicyParams {
  tenantId: string;
  functionalCurrencyCode: string;
  updatedBy: string;
}

/**
 * @description Compatibilidad interna; delega toda escritura al orquestador único.
 * @param {SetTenantAccountingPolicyParams} params - Tenant, moneda probada y actor.
 * @returns {Promise<ProvisionAccountingPolicyResult>} Resultado del provisioning.
 */
export async function setTenantAccountingPolicy(
  params: SetTenantAccountingPolicyParams,
): Promise<ProvisionAccountingPolicyResult> {
  return provisionTenantAccountingPolicy({
    tenantId: params.tenantId,
    functionalCurrencyCode: params.functionalCurrencyCode,
    actorUserId: params.updatedBy,
    origin: 'TENANT_UI',
    reason: 'Configuración interactiva de moneda funcional',
    correlationId: `legacy-${params.tenantId}`,
  });
}
