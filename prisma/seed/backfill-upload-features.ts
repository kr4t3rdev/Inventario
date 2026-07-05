/**
 * @description Backfill de upload feature flags para planes ya existentes.
 *
 * Uso:
 *   pnpm tsx prisma/seed/backfill-upload-features.ts
 */

import { Prisma, PrismaClient } from '../../src/generated/prisma';
import {
  PLAN_BASICO_FEATURES,
  PLAN_EMPRESARIAL_FEATURES,
  PLAN_PROFESIONAL_FEATURES,
} from './plans-seed';

const prisma = new PrismaClient();

const PLAN_UPLOAD_FEATURES_BY_NAME: Record<string, Record<string, boolean>> = {
  'Básico': pickUploadFeatures(PLAN_BASICO_FEATURES),
  Profesional: pickUploadFeatures(PLAN_PROFESIONAL_FEATURES),
  Empresarial: pickUploadFeatures(PLAN_EMPRESARIAL_FEATURES),
};

function pickUploadFeatures(features: Record<string, boolean>): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(features).filter(([key]) => key.startsWith('upload-'))
  );
}

async function backfillUploadFeatures(): Promise<void> {
  const plans = await prisma.plan.findMany({
    select: {
      planId: true,
      nombre: true,
      features: true,
    },
  });

  for (const plan of plans) {
    const uploadFeatures = PLAN_UPLOAD_FEATURES_BY_NAME[plan.nombre];
    if (!uploadFeatures) {
      console.warn(`⚠️ Se omite plan sin preset conocido: ${plan.nombre}`);
      continue;
    }

    const currentFeatures =
      plan.features && typeof plan.features === 'object' && !Array.isArray(plan.features)
        ? (plan.features as Record<string, unknown>)
        : {};

    await prisma.plan.update({
      where: { planId: plan.planId },
      data: {
        features: {
          ...currentFeatures,
          ...uploadFeatures,
        } as Prisma.InputJsonValue,
      },
    });

    console.log(`✅ Upload features actualizados para ${plan.nombre}`);
  }
}

if (require.main === module) {
  backfillUploadFeatures()
    .catch((error) => {
      console.error('❌ Error en backfill de upload features:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { backfillUploadFeatures };
