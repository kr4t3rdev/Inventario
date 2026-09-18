/**
 * @description Orquesta el seed de datos demo para un tenant específico.
 *              Según el perfil del plan, ejecuta:
 *                - Básico:       solo seed base
 *                - Profesional:  base + extras profesional
 *                - Empresarial:  base + extras empresarial
 *
 *              Cada perfil cuenta una historia distinta:
 *                - Básico:       "Negocio pequeño listo para operar"
 *                - Profesional:  "Negocio en crecimiento con más control y volumen"
 *                - Empresarial:  "Operación robusta multi-sede — empresa real"
 *
 * @module lib/services/demo-seed
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma';
import { seedBaseDemoData } from '../../../prisma/seed/demo/base-seed';
import { seedProfessionalExtras } from '../../../prisma/seed/demo/professional-seed';
import { seedEnterpriseExtras } from '../../../prisma/seed/demo/enterprise-seed';

export interface SeedDemoTenantDataInput {
  tenantId: string;
  planName: string;
  client?: Prisma.TransactionClient;
}

export interface SeedDemoTenantDataResult {
  tenantId: string;
  planName: string;
  profile: 'basic' | 'professional' | 'enterprise';
}

/**
 * @description Mapea el nombre comercial del plan a un perfil interno de seed.
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
 * @description Siembra datos demo según el perfil del plan.
 *              Usa una transacción de Prisma para pasar el cliente a cada seed.
 */
export async function seedDemoTenantData(
  input: SeedDemoTenantDataInput,
): Promise<SeedDemoTenantDataResult> {
  const profile = resolveSeedProfile(input.planName);

  const runSeeds = async (tx: Prisma.TransactionClient): Promise<void> => {
    // 1. Base común para todos los planes
    //    Historia: negocio pequeño, 1 almacén, 1 PV, ~20 productos
    await seedBaseDemoData({ tenantId: input.tenantId }, tx);

    // 2. Extras según perfil
    if (profile === 'enterprise') {
      // Incluye profesional + empresarial extras
      await seedProfessionalExtras({ tenantId: input.tenantId }, tx);
      await seedEnterpriseExtras({ tenantId: input.tenantId }, tx);
    } else if (profile === 'professional') {
      await seedProfessionalExtras({ tenantId: input.tenantId }, tx);
    }
    // Básico: solo el base (ya ejecutado arriba)
  };

  if (input.client) {
    await runSeeds(input.client);
  } else {
    await prisma.$transaction(runSeeds);
  }

  return {
    tenantId: input.tenantId,
    planName: input.planName,
    profile,
  };
}

export { resolveSeedProfile };
