/**
 * @description Sincroniza los features canónicos de los planes y de las licencias
 * existentes con la definición actual en `prisma/seed/plans-seed.ts`.
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

    const updatedLicenses = await prisma.tenantLicense.updateMany({
      where: { planId: plan.planId },
      data: { features: canonicalFeatures },
    });

    console.log(
      `✓ ${plan.nombre}: plan sincronizado y ${updatedLicenses.count} licencia(s) actualizada(s).`,
    );
  }

  console.log('✅ Features de planes y licencias sincronizados.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
