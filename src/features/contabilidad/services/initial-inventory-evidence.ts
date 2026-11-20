import { createHash } from 'node:crypto';

/**
 * @description Calcula un hash estable para evidencia JSON plana sin depender
 * del orden en que PostgreSQL devuelva las claves de jsonb.
 * @param evidence - Evidencia serializable de la fuente inicial.
 * @returns Hash SHA-256 de la representación canónica.
 */
export function hashInitialInventoryEvidence(evidence: Record<string, unknown>): string {
  const canonical = Object.fromEntries(
    Object.entries(evidence).sort(([left], [right]) => (
      left < right ? -1 : left > right ? 1 : 0
    )),
  );
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
