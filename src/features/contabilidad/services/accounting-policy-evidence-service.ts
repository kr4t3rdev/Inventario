import type { AccountingPolicyEvidenceResult } from '@/features/contabilidad/types/accounting-policy';

interface CountDelegate {
  count(args: { where: Record<string, unknown> }): Promise<number>;
}

export interface AccountingEvidenceClient {
  financialAuxiliaryCheckpoint: CountDelegate;
  snapshotPeriodo: CountDelegate;
  reconciliacionVenta: CountDelegate;
  reconciliacionServicio: CountDelegate;
  reconciliacionGasto: CountDelegate;
}

/**
 * @description Clasifica evidencia contable canónica sin inferir moneda funcional.
 * @param {AccountingEvidenceClient} client - Cliente Prisma o transacción activa.
 * @param {string} tenantId - Tenant exacto que se inspeccionará.
 * @returns {Promise<AccountingPolicyEvidenceResult>} Clasificación y conteos seguros.
 */
export async function classifyAccountingPolicyEvidence(
  client: AccountingEvidenceClient,
  tenantId: string,
): Promise<AccountingPolicyEvidenceResult> {
  try {
    const [checkpoints, snapshots, sales, services, expenses] = await Promise.all([
      client.financialAuxiliaryCheckpoint.count({ where: { tenantId } }),
      client.snapshotPeriodo.count({
        where: { periodo: { tenantId, estado: 'APROBADO' } },
      }),
      client.reconciliacionVenta.count({ where: { tenantId, fxEvidenceVersion: 1 } }),
      client.reconciliacionServicio.count({ where: { tenantId, fxEvidenceVersion: 1 } }),
      client.reconciliacionGasto.count({ where: { tenantId, fxEvidenceVersion: 1 } }),
    ]);
    const counts = { checkpoints, snapshots, sales, services, expenses };

    return {
      classification: Object.values(counts).some((count) => count > 0) ? 'PRESENT' : 'NONE',
      counts,
    };
  } catch {
    return { classification: 'REVIEW_REQUIRED', counts: null };
  }
}
