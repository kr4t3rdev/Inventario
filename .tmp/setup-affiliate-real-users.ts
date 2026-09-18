import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();
const suffix = `real-${Date.now()}`;
const password = 'RealPass123!';

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);
  const plan = await prisma.plan.findFirstOrThrow({ where: { nombre: 'Profesional' } });

  const admin = await prisma.user.create({
    data: {
      name: `Admin ${suffix}`,
      email: `admin-${suffix}@test.local`,
      password: passwordHash,
      role: 'admin',
      isActive: true,
      onboardingStatus: null,
      emailVerifiedAt: new Date(),
    },
  });

  const referrerUser = await prisma.user.create({
    data: {
      name: `Referrer ${suffix}`,
      email: `referrer-${suffix}@test.local`,
      password: passwordHash,
      role: 'user',
      isActive: true,
      onboardingStatus: null,
      emailVerifiedAt: new Date(),
    },
  });

  const referrerTenant = await prisma.tenant.create({
    data: {
      nombre: `Referrer Tenant ${suffix}`,
      slug: `referrer-${suffix}`,
    },
  });

  await prisma.tenantMembership.create({
    data: {
      tenantId: referrerTenant.tenantId,
      userId: referrerUser.userId,
      tenantRole: 'manager',
      isActive: true,
    },
  });

  await prisma.tenantLicense.create({
    data: {
      tenantId: referrerTenant.tenantId,
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

  console.log(JSON.stringify({
    suffix,
    password,
    admin: { email: admin.email, userId: admin.userId },
    referrer: { email: referrerUser.email, userId: referrerUser.userId, tenantId: referrerTenant.tenantId },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
