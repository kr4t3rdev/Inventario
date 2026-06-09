/**
 * @description Seed one-shot para crear TenantLicense a todos los tenants que no tengan una activa.
 * Excluye tenants llamados "admin" o "test".
 *
 * Ejecutar: npx tsx prisma/seed/tenant-licenses-seed.ts
 *
 * @module prisma/seed/tenant-licenses-seed
 */

import { PrismaClient } from "../../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Buscando tenants sin licencia activa...");

  // Resolver plan default (el más barato = plan básico)
  const defaultPlan = await prisma.plan.findFirst({ orderBy: { precio: "asc" } });

  if (!defaultPlan) {
    console.error("❌ No hay planes en la base de datos. Ejecutá primero el seed de planes:");
    console.error("   npx tsx prisma/seed/plans-seed.ts");
    process.exit(1);
  }

  console.log(`📋 Plan default: ${defaultPlan.nombre} ($${defaultPlan.precio})`);

  // Buscar tenants sin licencia activa, excluyendo admin y test
  const tenants = await prisma.tenant.findMany({
    where: {
      licencias: { none: { activa: true } },
      NOT: [
        { nombre: { contains: "admin", mode: "insensitive" } },
        { nombre: { contains: "test", mode: "insensitive" } },
        { slug: { contains: "admin", mode: "insensitive" } },
        { slug: { contains: "test", mode: "insensitive" } },
      ],
    },
    select: {
      tenantId: true,
      nombre: true,
      memberships: {
        where: { isActive: true },
        select: { membershipId: true },
        take: 1,
      },
    },
  });

  console.log(`📊 Encontrados ${tenants.length} tenants sin licencia activa.`);

  let created = 0;
  let skipped = 0;

  for (const tenant of tenants) {
    // Solo crear licencia si el tenant tiene membresías activas
    if (tenant.memberships.length === 0) {
      console.log(`  ⏭️  ${tenant.nombre} — sin memberships activas, omitido`);
      skipped++;
      continue;
    }

    await prisma.tenantLicense.create({
      data: {
        tenantId: tenant.tenantId,
        planId: defaultPlan.planId,
        activa: true,
        inicio: new Date(),
        expiracion: new Date(Date.now() + 365 * 86400000), // 1 año
        maxUsuarios: defaultPlan.maxUsuarios,
        maxAlmacenes: defaultPlan.maxAlmacenes,
        maxProductos: defaultPlan.maxProductos,
        features: defaultPlan.features as any,
      },
    });
    created++;
    console.log(`  ✅ ${tenant.nombre} — licencia creada (plan: ${defaultPlan.nombre})`);
  }

  console.log(`\n✅ ${created} licencias creadas. ${skipped} tenants omitidos (sin memberships activas).`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
