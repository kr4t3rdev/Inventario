import bcrypt from 'bcryptjs';
import { PrismaClient } from '../../../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const suffix = `hostflow-${Date.now()}`;
  const password = process.env.TEMP_PASSWORD || 'Temp123456!';
  const hash = await bcrypt.hash(password, 12);
  const planName = process.env.PLAN_NAME || 'Profesional';

  const plan = await prisma.plan.findFirstOrThrow({ where: { nombre: planName } });
  const user = await prisma.user.create({
    data: {
      name: `Referrer ${suffix}`,
      email: `referrer-${suffix}@test.local`,
      password: hash,
      role: 'user',
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });

  const tenant = await prisma.tenant.create({
    data: { nombre: `Referrer ${suffix}`, slug: `referrer-${suffix}` },
  });

  await prisma.tenantMembership.create({
    data: { tenantId: tenant.tenantId, userId: user.userId, tenantRole: 'manager', isActive: true },
  });

  await prisma.tenantLicense.create({
    data: {
      tenantId: tenant.tenantId,
      planId: plan.planId,
      activa: true,
      inicio: new Date(),
      expiracion: new Date(Date.now() + 30 * 86400000),
      maxUsuarios: plan.maxUsuarios,
      maxAlmacenes: plan.maxAlmacenes,
      maxProductos: plan.maxProductos,
      maxClientes: plan.maxClientes,
      featureOverrides: {},
      listPriceUsd: plan.precio,
      finalPriceUsd: plan.precio,
    },
  });

  const profile = await prisma.affiliateProfile.create({
    data: {
      tenantId: tenant.tenantId,
      referralCode: `REF-${suffix.slice(-6).toUpperCase()}`,
      isEligible: true,
      status: 'active',
    },
  });

  console.log(JSON.stringify({ suffix, userId: user.userId, tenantId: tenant.tenantId, referralCode: profile.referralCode, tempPassword: password }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
