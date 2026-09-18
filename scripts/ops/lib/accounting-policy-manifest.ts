import { createHash } from 'node:crypto';

import { z } from 'zod';

const forbiddenCurrencyCodes = new Set(['*', 'DEFAULT', 'PRIMARY']);

const entrySchema = z.object({
  tenantId: z.string().trim().min(1),
  functionalCurrencyCode: z.string().trim().min(1).transform((value) => value.toUpperCase())
    .refine((value) => !forbiddenCurrencyCodes.has(value), 'La moneda debe ser literal'),
  expectedClassification: z.enum(['MISSING_NO_EVIDENCE', 'MISSING_WITH_EVIDENCE']),
  origin: z.literal('ROLLOUT'),
  reason: z.string().trim().min(1),
  tenantApprovalId: z.string().trim().min(1).optional(),
});

const manifestSchema = z.object({
  version: z.literal(1),
  reason: z.string().trim().min(1),
  platformApproval: z.object({
    approverUserId: z.string().trim().min(1),
    reference: z.string().trim().min(1),
    approvedAt: z.string().datetime(),
  }),
  entries: z.array(entrySchema).min(1),
}).superRefine((manifest, context) => {
  const tenants = new Set<string>();
  manifest.entries.forEach((entry, index) => {
    if (tenants.has(entry.tenantId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['entries', index, 'tenantId'],
        message: `Tenant duplicado: ${entry.tenantId}`,
      });
    }
    tenants.add(entry.tenantId);
  });
});

export type AccountingPolicyManifestV1 = z.infer<typeof manifestSchema>;

/**
 * @description Valida un manifiesto V1 sin consultar configuración global ni base de datos.
 * @param {unknown} input - Contenido JSON no confiable.
 * @returns {AccountingPolicyManifestV1} Manifiesto validado e inmutable por convención.
 */
export function parseAccountingPolicyManifest(input: unknown): AccountingPolicyManifestV1 {
  return manifestSchema.parse(input);
}

/**
 * @description Canonicaliza el manifiesto ordenando entradas por tenant.
 * @param {AccountingPolicyManifestV1} manifest - Manifiesto validado.
 * @returns {string} JSON canónico para vincular dry-run y apply.
 */
export function canonicalizeAccountingPolicyManifest(
  manifest: AccountingPolicyManifestV1,
): string {
  return JSON.stringify({
    ...manifest,
    entries: [...manifest.entries].sort((left, right) =>
      left.tenantId.localeCompare(right.tenantId)),
  });
}

/**
 * @description Calcula SHA-256 del contenido canónico aprobado.
 * @param {AccountingPolicyManifestV1} manifest - Manifiesto validado.
 * @returns {string} Digest hexadecimal estable.
 */
export function getAccountingPolicyManifestHash(
  manifest: AccountingPolicyManifestV1,
): string {
  return createHash('sha256')
    .update(canonicalizeAccountingPolicyManifest(manifest))
    .digest('hex');
}
