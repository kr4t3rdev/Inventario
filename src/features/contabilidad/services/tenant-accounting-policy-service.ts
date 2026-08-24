import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/lib/prisma';
import { acquireAccountingTenantLock } from './accounting-tenant-lock-service';

type PolicyErrorCode =
  | 'TENANT_ACCOUNTING_POLICY_REQUIRED'
  | 'FUNCTIONAL_CURRENCY_NOT_AVAILABLE'
  | 'FUNCTIONAL_CURRENCY_IMMUTABLE';

/** Error esperado al resolver o modificar la política contable de un tenant. */
export class TenantAccountingPolicyError extends Error {
  /**
   * @description Construye un error tipado de política contable.
   * @param {string} message - Mensaje seguro.
   * @param {PolicyErrorCode} code - Código estable del dominio.
   * @returns {TenantAccountingPolicyError} Error tipado.
   */
  constructor(message: string, public readonly code: PolicyErrorCode) {
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

interface SetTenantAccountingPolicyParams {
  tenantId: string;
  functionalCurrencyCode: string;
  updatedBy: string;
}

/**
 * @description Crea o actualiza la política sin inferirla del catálogo global.
 * @param {SetTenantAccountingPolicyParams} params - Tenant, moneda probada y actor.
 * @returns {Promise<object>} Política persistida.
 */
export async function setTenantAccountingPolicy(params: SetTenantAccountingPolicyParams) {
  const currencyCode = params.functionalCurrencyCode.trim().toUpperCase();
  return prisma.$transaction(async (tx) => {
    await acquireAccountingTenantLock(tx, params.tenantId);
    const currency = await tx.moneda.findFirst({
      where: { codigo: currencyCode, isActive: true },
      select: { codigo: true },
    });
    if (!currency) {
      throw new TenantAccountingPolicyError(
        'La moneda funcional seleccionada no está disponible',
        'FUNCTIONAL_CURRENCY_NOT_AVAILABLE',
      );
    }

    const existing = await tx.tenantAccountingPolicy.findUnique({
      where: { tenantId: params.tenantId },
      select: { tenantId: true, functionalCurrencyCode: true, updatedBy: true },
    });
    if (!existing) {
      return tx.tenantAccountingPolicy.create({
        data: {
          tenantId: params.tenantId,
          functionalCurrencyCode: currencyCode,
          updatedBy: params.updatedBy,
        },
      });
    }
    if (existing.functionalCurrencyCode === currencyCode) {
      return existing;
    }

    const evidenceCounts = await Promise.all([
      tx.financialAuxiliaryCheckpoint.count({ where: { tenantId: params.tenantId } }),
      tx.snapshotPeriodo.count({
        where: {
          periodo: { tenantId: params.tenantId, estado: 'APROBADO' },
        },
      }),
      tx.reconciliacionVenta.count({
        where: { tenantId: params.tenantId, fxEvidenceVersion: 1 },
      }),
      tx.reconciliacionServicio.count({
        where: { tenantId: params.tenantId, fxEvidenceVersion: 1 },
      }),
      tx.reconciliacionGasto.count({
        where: { tenantId: params.tenantId, fxEvidenceVersion: 1 },
      }),
    ]);
    if (evidenceCounts.some((count) => count > 0)) {
      throw new TenantAccountingPolicyError(
        'La moneda funcional no puede cambiar después de registrar evidencia contable',
        'FUNCTIONAL_CURRENCY_IMMUTABLE',
      );
    }
    return tx.tenantAccountingPolicy.update({
      where: { tenantId: params.tenantId },
      data: { functionalCurrencyCode: currencyCode, updatedBy: params.updatedBy },
    });
  }, { isolationLevel: 'Serializable' });
}
