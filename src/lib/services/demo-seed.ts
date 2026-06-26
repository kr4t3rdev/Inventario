/**
 * @description Orquesta el seed de datos demo para un tenant específico.
 *              Reutiliza el seed de implementación actual como baseline y deja
 *              preparado el branching por plan para slices posteriores.
 *
 * @module lib/services/demo-seed
 */

import { seedImplementationData } from '../../../prisma/seed/implementation-seed';

export interface SeedDemoTenantDataInput {
  tenantId: string;
  planName: string;
}

export interface SeedDemoTenantDataResult {
  tenantId: string;
  planName: string;
  profile: 'basic' | 'professional' | 'enterprise';
}

/**
 * @description Mapea el nombre comercial del plan a un perfil interno de seed.
 * @param {string} planName - Nombre del plan de la licencia demo.
 * @returns {'basic' | 'professional' | 'enterprise'} Perfil interno.
 */
function resolveSeedProfile(
  planName: string,
): 'basic' | 'professional' | 'enterprise' {
  const normalized = planName.trim().toLowerCase();

  if (normalized === 'empresarial' || normalized === 'enterprise') {
    return 'enterprise';
  }

  if (normalized === 'profesional' || normalized === 'professional') {
    return 'professional';
  }

  return 'basic';
}

/**
 * @description Siembra datos base para un tenant demo y deja resuelto el perfil
 *              por plan para extensiones premium futuras.
 * @param {SeedDemoTenantDataInput} input - Tenant y plan destino.
 * @returns {Promise<SeedDemoTenantDataResult>} Resultado del seed ejecutado.
 */
export async function seedDemoTenantData(
  input: SeedDemoTenantDataInput,
): Promise<SeedDemoTenantDataResult> {
  const profile = resolveSeedProfile(input.planName);

  await seedImplementationData({
    tenantId: input.tenantId,
  });

  return {
    tenantId: input.tenantId,
    planName: input.planName,
    profile,
  };
}

export { resolveSeedProfile };
