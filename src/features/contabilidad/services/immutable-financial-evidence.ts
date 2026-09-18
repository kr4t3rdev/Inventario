import { createHash } from 'node:crypto';

/**
 * @description Serializa JSON con claves ordenadas para obtener una representación estable.
 * @param {unknown} value - Valor que se serializará.
 * @returns {string} JSON canónico.
 */
export function canonicalizeFinancialEvidence(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeFinancialEvidence).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => (
      `${JSON.stringify(key)}:${canonicalizeFinancialEvidence(record[key])}`
    ))
    .join(',')}}`;
}

/**
 * @description Calcula el SHA-256 de evidencia financiera canónica.
 * @param {unknown} value - Evidencia que se protegerá.
 * @returns {string} Huella hexadecimal.
 */
export function hashImmutableFinancialEvidence(value: unknown): string {
  return createHash('sha256').update(canonicalizeFinancialEvidence(value)).digest('hex');
}
