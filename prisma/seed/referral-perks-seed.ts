/**
 * Seed script para el catálogo persistido de referral perks.
 *
 * Ejecutar: pnpm tsx prisma/seed/referral-perks-seed.ts
 */

import { PrismaClient } from '../../src/generated/prisma';

import { REFERRAL_PERK_CATALOG } from '../../src/features/affiliate/referral-perk-catalog';

const prisma = new PrismaClient();

export async function seedReferralPerkCatalog(): Promise<void> {
  for (const perk of REFERRAL_PERK_CATALOG) {
    await prisma.referralPerkCatalog.upsert({
      where: { key: perk.key },
      update: {
        label: perk.label,
        description: perk.description,
        isActive: perk.isActive,
        adminOnly: perk.adminOnly,
      },
      create: {
        key: perk.key,
        label: perk.label,
        description: perk.description,
        isActive: perk.isActive,
        adminOnly: perk.adminOnly,
      },
    });
  }

  console.log(`✅ Referral perks sincronizados: ${REFERRAL_PERK_CATALOG.length}`);
}

if (require.main === module) {
  seedReferralPerkCatalog()
    .catch((error) => {
      console.error('❌ Error sembrando referral perks:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
