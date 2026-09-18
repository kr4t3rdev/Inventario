/**
 * @description Sincroniza solo `Plan.features` con la definición canónica de
 * `prisma/seed/plans-seed.ts`.
 *
 * Importante: NO toca `TenantLicense.features` porque eso es un snapshot legacy
 * y la arquitectura nueva resuelve permisos desde `Plan.features` +
 * `TenantLicense.featureOverrides`.
 *
 * Ejecutar: npx tsx scripts/sync-plan-features.ts
 */

import { PrismaClient } from '../src/generated/prisma';
import {
  PLAN_BASICO_FEATURES,
  PLAN_EMPRESARIAL_FEATURES,
  PLAN_PROFESIONAL_FEATURES,
} from '../prisma/seed/plans-seed';

const prisma = new PrismaClient();

const FEATURES_BY_PLAN_NAME: Record<string, Record<string, boolean>> = {
  'Básico': PLAN_BASICO_FEATURES,
  'Profesional': PLAN_PROFESIONAL_FEATURES,
  'Empresarial': PLAN_EMPRESARIAL_FEATURES,
};

async function main() {
  const plans = await prisma.plan.findMany({
    select: { planId: true, nombre: true, features: true },
  });

  for (const plan of plans) {
    const canonicalFeatures = FEATURES_BY_PLAN_NAME[plan.nombre];
    if (!canonicalFeatures) {
      console.log(`↪ Plan omitido sin definición canónica: ${plan.nombre}`);
      continue;
    }

    await prisma.plan.update({
      where: { planId: plan.planId },
      data: { features: canonicalFeatures },
    });

    console.log(`✓ ${plan.nombre}: Plan.features sincronizado.`);
  }

  console.log('✅ Plan.features sincronizado con la definición canónica.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
