'use server';

import { createHash, randomUUID } from 'node:crypto';

import { z } from 'zod';

import { canManageAccountingPolicy } from '@/lib/auth/accounting-policy-capabilities';
import type { AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import { ActionError, withAction } from '@/lib/server-actions';
import { AuditLogService } from '@/lib/services/audit-log-service';
import { requireTenant } from '@/lib/services/tenant-scope';

import {
  classifyAccountingPolicyEvidence,
  type AccountingEvidenceClient,
} from './services/accounting-policy-evidence-service';
import { provisionTenantAccountingPolicy } from './services/tenant-accounting-policy-service';

const allowedReturnPaths = new Set([
  '/busy/contabilidad/balance-resultados',
  '/busy/contabilidad/balance-resultados#moneda-funcional',
  '/busy/contabilidad/configuracion',
]);

const currencyCodeSchema = z.string().trim().regex(/^[A-Za-z]{3}$/, {
  message: 'Selecciona un código de moneda válido',
}).transform((value) => value.toUpperCase());

const policyInputSchema = z.object({
  functionalCurrencyCode: currencyCodeSchema,
  reason: z.string().trim().min(10).max(500),
  returnTo: z.string().trim().optional().refine(
    (value) => value === undefined || allowedReturnPaths.has(value),
    'La ruta de retorno no está permitida',
  ),
});

const approvalInputSchema = policyInputSchema.omit({ returnTo: true });

/**
 * @description Exige capacidad efectiva de gestión para el tenant autenticado.
 * @param {AuthenticatedUser} user - Actor autenticado.
 * @param {string} tenantId - Tenant derivado por requireTenant.
 * @returns {Promise<void>} Finaliza solo cuando la capacidad fue revalidada.
 */
async function requireAccountingPolicyManager(
  user: AuthenticatedUser,
  tenantId: string,
): Promise<void> {
  if (!await canManageAccountingPolicy(user.userId, tenantId)) {
    throw new ActionError(
      'No tienes permisos para gestionar la moneda funcional de esta empresa',
      'FORBIDDEN',
    );
  }
}

export const getAccountingPolicyStateAction = withAction(
  async (_input: void, user: AuthenticatedUser) => {
    const tenantId = requireTenant(user);
    const canManage = await canManageAccountingPolicy(user.userId, tenantId);
    const policy = await prisma.tenantAccountingPolicy.findUnique({
      where: { tenantId },
      select: {
        functionalCurrencyCode: true,
        createdAt: true,
        updatedBy: true,
      },
    });
    const evidence = policy
      ? null
      : await classifyAccountingPolicyEvidence(
          prisma as unknown as AccountingEvidenceClient,
          tenantId,
        );

    return { policy, evidence: evidence?.classification ?? null, canManage };
  },
);

export const setInitialAccountingPolicyAction = withAction(
  async (input: z.infer<typeof policyInputSchema>, user: AuthenticatedUser) => {
    const parsed = policyInputSchema.parse(input);
    const tenantId = requireTenant(user);
    await requireAccountingPolicyManager(user, tenantId);

    const result = await provisionTenantAccountingPolicy({
      tenantId,
      functionalCurrencyCode: parsed.functionalCurrencyCode,
      actorUserId: user.userId,
      origin: 'TENANT_UI',
      reason: parsed.reason,
      correlationId: randomUUID(),
    });
    if (result.result === 'BLOCKED') {
      throw new ActionError(
        'La configuración de moneda funcional quedó bloqueada para revisión',
        'ACCOUNTING_POLICY_BLOCKED',
      );
    }
    return result;
  },
);

export const createTenantAccountingPolicyApprovalAction = withAction(
  async (input: z.infer<typeof approvalInputSchema>, user: AuthenticatedUser) => {
    const parsed = approvalInputSchema.parse(input);
    const tenantId = requireTenant(user);
    await requireAccountingPolicyManager(user, tenantId);

    return prisma.$transaction(async (tx) => {
      const evidence = await classifyAccountingPolicyEvidence(
        tx as unknown as AccountingEvidenceClient,
        tenantId,
      );
      if (evidence.classification !== 'PRESENT') {
        throw new ActionError(
          evidence.classification === 'REVIEW_REQUIRED'
            ? 'No se pudo verificar la evidencia contable de forma confiable'
            : 'La aprobación adicional no es necesaria para esta empresa',
          'ACCOUNTING_POLICY_REVIEW_REQUIRED',
        );
      }

      const currency = await tx.moneda.findFirst({
        where: { codigo: parsed.functionalCurrencyCode, isActive: true },
        select: { codigo: true },
      });
      if (!currency) {
        throw new ActionError(
          'La moneda funcional seleccionada no está disponible',
          'FUNCTIONAL_CURRENCY_NOT_AVAILABLE',
        );
      }

      const correlationId = randomUUID();
      const approvalHash = createHash('sha256').update([
        tenantId,
        parsed.functionalCurrencyCode,
        user.userId,
        correlationId,
      ].join(':')).digest('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const approval = await tx.accountingPolicyTenantApproval.create({
        data: {
          tenantId,
          functionalCurrencyCode: parsed.functionalCurrencyCode,
          actorUserId: user.userId,
          reason: parsed.reason,
          correlationId,
          approvalHash,
          expiresAt,
        },
      });
      await AuditLogService.logStrict({
        accion: 'VALIDATE',
        entidad: 'TENANT_ACCOUNTING_POLICY',
        entidadId: tenantId,
        usuarioId: user.userId,
        detalles: {
          result: 'TENANT_APPROVAL_CREATED',
          tenantId,
          requestedCurrency: parsed.functionalCurrencyCode,
          evidence: evidence.classification,
          reason: parsed.reason,
          origin: 'TENANT_UI',
          correlationId,
          approvalId: approval.approvalId,
        },
      }, tx);

      return {
        status: 'PENDING_PLATFORM_REVIEW' as const,
        approvalId: approval.approvalId,
        expiresAt,
      };
    }, { isolationLevel: 'Serializable' });
  },
);
