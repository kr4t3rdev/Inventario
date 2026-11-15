/**
 * @description Motor de cálculo del tier actual del cliente.
 *
 * Compara el gasto anual y la frecuencia de compras contra los umbrales
 * de cada tier activo y retorna el nivel más alto que cumple.
 *
 * @module features/lealtad/services/tier-engine
 */

export interface TierInfo {
  nombre: string;
  orden: number;
  umbralGasto: number;
  umbralFrecuencia: number | null;
  activo: boolean;
}

export interface DeterminarTierParams {
  /** Gasto total del cliente en el año actual (centavos). */
  gastoAnual: number;
  /** Número de compras del cliente en el año actual. */
  frecuenciaAnual: number;
  /** Lista de tiers del programa, ordenados por `orden`. */
  tiers: readonly TierInfo[];
}

/**
 * @description Determina el tier más alto que un cliente cumple según
 * su gasto anual y frecuencia de compras.
 * @param {DeterminarTierParams} params - Datos del cliente y tiers disponibles.
 * @returns {TierInfo | null} El tier más alto cumplido, o null si no hay tiers activos.
 */
export function determinarTier(params: DeterminarTierParams): TierInfo | null {
  const tiersActivos = params.tiers
    .filter((t) => t.activo)
    .sort((a, b) => b.orden - a.orden);

  for (const tier of tiersActivos) {
    if (params.gastoAnual < tier.umbralGasto) continue;
    if (tier.umbralFrecuencia != null && params.frecuenciaAnual < tier.umbralFrecuencia) continue;
    return tier;
  }

  return null;
}

/**
 * @description Verifica si un cliente ascendió de tier comparando el orden
 * del tier anterior con el nuevo. Solo retorna true si el orden aumentó.
 * @param {object} params - Parámetros de comparación.
 * @param {string | null} params.tierAnterior - Nombre del tier anterior.
 * @param {TierInfo | null} params.nuevoTier - Tier calculado actualmente.
 * @param {TierInfo[]} params.tiers - Lista completa de tiers para buscar el orden anterior.
 * @returns {boolean} True si el cliente ascendió de nivel (orden aumentó).
 */
export function ascensoTier(params: {
  tierAnterior: string | null;
  nuevoTier: TierInfo | null;
  tiers?: TierInfo[];
}): boolean {
  if (!params.nuevoTier) return false;
  if (!params.tierAnterior) return true;
  if (params.nuevoTier.nombre === params.tierAnterior) return false;

  // Busca el orden del tier anterior en la lista de tiers
  const tierAnteriorInfo = params.tiers?.find((t) => t.nombre === params.tierAnterior);
  if (!tierAnteriorInfo) return false;

  return params.nuevoTier.orden > tierAnteriorInfo.orden;
}
