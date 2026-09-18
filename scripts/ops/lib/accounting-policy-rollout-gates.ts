import { ActionError } from '@/lib/server-actions';

export interface AccountingPolicyRolloutGateProof {
  verified: boolean;
  evidenceRef: string;
}

export interface AccountingPolicyRolloutGates {
  capabilityMappings: AccountingPolicyRolloutGateProof;
  tenantResponsibles: AccountingPolicyRolloutGateProof;
  databaseBackup: AccountingPolicyRolloutGateProof;
  pilot: AccountingPolicyRolloutGateProof;
}

const GATE_LABELS: Record<keyof AccountingPolicyRolloutGates, string> = {
  capabilityMappings: 'mapeos de capacidades',
  tenantResponsibles: 'responsables de tenant',
  databaseBackup: 'respaldo de base de datos',
  pilot: 'piloto',
};

/**
 * @description Verifica que cada control de producción tenga una prueba explícita.
 * @param {unknown} gates - Pruebas suministradas por la sesión operativa.
 * @returns {void} No retorna cuando todos los gates están satisfechos.
 * @throws {ActionError} Cuando falta una prueba verificable.
 */
export function assertAccountingPolicyRolloutGates(gates: unknown): void {
  const candidate = gates as Partial<AccountingPolicyRolloutGates> | null | undefined;
  const missing = (Object.keys(GATE_LABELS) as Array<keyof AccountingPolicyRolloutGates>)
    .filter((key) => {
      const proof = candidate?.[key];
      return proof?.verified !== true
        || typeof proof.evidenceRef !== 'string'
        || proof.evidenceRef.trim().length === 0;
    })
    .map((key) => GATE_LABELS[key]);

  if (missing.length > 0) {
    throw new ActionError(
      `Faltan gates de producción verificables: ${missing.join(', ')}`,
      'ROLLOUT_NOT_READY',
    );
  }
}
