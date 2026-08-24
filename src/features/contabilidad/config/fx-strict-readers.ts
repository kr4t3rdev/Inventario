/** Fuentes contables que pueden activar lectura estricta de evidencia FX. */
export type FxReaderSource = 'result' | 'summary' | 'movements' | 'snapshot';

/**
 * @description Indica si una fuente exige evidencia FX persistida y excluye filas legacy.
 * Controlada por la variable FX_STRICT_READERS (lista separada por comas o '*').
 * @param {FxReaderSource} source - Fuente contable a consultar.
 * @returns {boolean} Indica si la fuente opera en modo estricto.
 */
export function isStrictFxReader(source: FxReaderSource): boolean {
  const raw = process.env.FX_STRICT_READERS ?? '';
  const allowlist = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return allowlist.includes('*') || allowlist.includes(source);
}
