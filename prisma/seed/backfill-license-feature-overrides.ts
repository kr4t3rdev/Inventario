/**
 * @description Convierte snapshots legacy de TenantLicense.features en
 * featureOverrides mínimos contra Plan.features.
 *
 * Uso:
 *   pnpm tsx prisma/seed/backfill-license-feature-overrides.ts
 */

import { Prisma, PrismaClient } from '../../src/generated/prisma';
import { diffPlanFeaturesToOverrides } from '../../src/lib/plan-features';

const prisma = new PrismaClient();

export function buildLicenseOverrideBackfill(input: {
  planFeatures?: Record<string, boolean> | null;
  legacyLicenseFeatures?: Record<string, boolean> | null;
}): {
  features: null;
  featureOverrides: Record<string, boolean>;
} {
  return {
    features: null,
    featureOverrides: diffPlanFeaturesToOverrides(input),
  };
}

export async function backfillLicenseFeatureOverrides(): Promise<number> {
  const licenses = await prisma.tenantLicense.findMany({
    select: {
      tenantLicenseId: true,
      features: true,
      plan: {
        select: {
          features: true,
        },
      },
    },
  });

  let updatedLicenses = 0;

  for (const license of licenses) {
    const backfillData = buildLicenseOverrideBackfill({
      planFeatures:
        license.plan?.features && typeof license.plan.features === 'object'
          ? (license.plan.features as Record<string, boolean>)
          : undefined,
      legacyLicenseFeatures:
        license.features && typeof license.features === 'object'
          ? (license.features as Record<string, boolean>)
          : undefined,
    });

    await prisma.tenantLicense.update({
      where: { tenantLicenseId: license.tenantLicenseId },
      data: {
        features: Prisma.DbNull,
        featureOverrides: backfillData.featureOverrides as Prisma.InputJsonValue,
      },
    });

    updatedLicenses++;
  }

  return updatedLicenses;
}

if (require.main === module) {
  backfillLicenseFeatureOverrides()
    .then((updatedLicenses) => {
      console.log(`🎯 Licencias convertidas a featureOverrides: ${updatedLicenses}`);
    })
    .catch((error) => {
      console.error('❌ Error en backfill de license feature overrides:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
