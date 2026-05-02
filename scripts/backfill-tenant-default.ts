/**
 * @description Backfill: crea el tenant default a partir de MiEmpresa actual,
 * asocia todos los registros existentes y asigna membresías a usuarios activos.
 *
 * Uso: npx tsx scripts/backfill-tenant-default.ts
 *
 * Este script es IDEMPOTENTE: si ya existe un tenant default, no lo duplica.
 */

import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('[backfill-tenant-default] Iniciando...\n');

  // ── 1. Verificar si ya hay un tenant creado ──
  const existingTenant = await prisma.tenant.findFirst({
    orderBy: { createdAt: 'asc' },
  });

  if (existingTenant) {
    console.log(`[backfill-tenant-default] Ya existe un tenant (${existingTenant.tenantId}). Verificando consistencia...`);

    const miEmpresa = await prisma.miEmpresa.findUnique({ where: { id: 1 } });
    if (miEmpresa && !miEmpresa.tenantId) {
      console.log('[backfill-tenant-default] MiEmpresa no tiene tenantId. Vinculando...');
      await prisma.miEmpresa.update({
        where: { id: 1 },
        data: { tenantId: existingTenant.tenantId },
      });
      console.log(`[backfill-tenant-default] MiEmpresa vinculada a tenant ${existingTenant.tenantId}`);
    }

    console.log('[backfill-tenant-default] Estado consistente. Nada que hacer.\n');
    return;
  }

  // ── 2. Obtener datos de MiEmpresa para nombrar el tenant ──
  const miEmpresa = await prisma.miEmpresa.findUnique({ where: { id: 1 } });
  const tenantName = miEmpresa?.nombre?.trim() || 'Mi Empresa';

  console.log(`[backfill-tenant-default] Creando tenant default: "${tenantName}"`);

  // ── 3. Crear tenant default ──
  const tenant = await prisma.tenant.create({
    data: {
      nombre: tenantName,
      slug: 'default',
    },
  });
  console.log(`[backfill-tenant-default] Tenant creado: ${tenant.tenantId}`);

  // ── 4. Vincular MiEmpresa al tenant ──
  if (miEmpresa) {
    await prisma.miEmpresa.update({
      where: { id: 1 },
      data: { tenantId: tenant.tenantId },
    });
    console.log('[backfill-tenant-default] MiEmpresa vinculada al tenant.');
  } else {
    console.warn('[backfill-tenant-default] No existe MiEmpresa. Se creará al configurar la empresa.');
  }

  // ── 5. Crear membresías para usuarios existentes ──
  const users = await prisma.user.findMany({
    where: { isActive: true },
  });
  console.log(`[backfill-tenant-default] Usuarios activos encontrados: ${users.length}`);

  let membershipsCreated = 0;
  for (const user of users) {
    // Verificar si ya tiene membresía en este tenant
    const existing = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: tenant.tenantId, userId: user.userId } },
    });

    if (existing) {
      console.log(`  ↳ ${user.email} ya tiene membresía. Saltando.`);
      continue;
    }

    // Mapear rol global actual a tenantRole
    // admin → admin, regularUser → dependiente, dependiente → dependiente
    const tenantRole = user.role === 'admin' ? 'admin' : 'dependiente';

    await prisma.tenantMembership.create({
      data: {
        tenantId: tenant.tenantId,
        userId: user.userId,
        tenantRole,
        isActive: true,
      },
    });
    membershipsCreated++;
    console.log(`  ✓ ${user.email} → membresía creada (rol: ${tenantRole})`);
  }

  console.log(`\n[backfill-tenant-default] Completado.`);
  console.log(`  Tenant:        ${tenant.tenantId} ("${tenantName}")`);
  console.log(`  Memberships:   ${membershipsCreated} creadas`);
}

main()
  .catch((e) => {
    console.error('[backfill-tenant-default] ERROR:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
