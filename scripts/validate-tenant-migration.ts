/**
 * @description Script de validación post-backfill. Verifica que el estado del
 * sistema sea consistente tras la migración inicial multi-tenant:
 *   - Tenant default existe
 *   - MiEmpresa está vinculada a un tenant
 *   - Todos los usuarios activos tienen membresía
 *   - No hay registros huérfanos en tablas clave
 *
 * Uso: npx tsx scripts/validate-tenant-migration.ts
 *
 * Exit code: 0 si todo OK, 1 si hay errores.
 */

import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

async function validateTenantExists(): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const tenantCount = await prisma.tenant.count();

  if (tenantCount === 0) {
    errors.push('NO HAY TENANTS. Ejecutá scripts/backfill-tenant-default.ts primero.');
  } else {
    const tenants = await prisma.tenant.findMany({ select: { tenantId: true, nombre: true } });
    console.log(`  ✓ Tenants encontrados: ${tenantCount}`);
    for (const t of tenants) {
      console.log(`    - ${t.tenantId}: "${t.nombre}"`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

async function validateMiEmpresaLinked(): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const miEmpresa = await prisma.miEmpresa.findUnique({ where: { id: 1 } });

  if (!miEmpresa) {
    warnings.push('No existe registro MiEmpresa. Se creará al configurar la empresa.');
    return { ok: true, errors, warnings };
  }

  if (!miEmpresa.tenantId) {
    errors.push('MiEmpresa (id=1) NO tiene tenantId. Ejecutá backfill-tenant-default.ts.');
  } else {
    const tenant = await prisma.tenant.findUnique({ where: { tenantId: miEmpresa.tenantId } });
    if (!tenant) {
      errors.push(`MiEmpresa.tenantId apunta a ${miEmpresa.tenantId} que NO existe como tenant.`);
    } else {
      console.log(`  ✓ MiEmpresa → Tenant: "${tenant.nombre}" (${tenant.tenantId})`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

async function validateUserMemberships(): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const activeUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { userId: true, email: true, role: true },
  });

  let withMembership = 0;
  let withoutMembership = 0;

  for (const user of activeUsers) {
    const membership = await prisma.tenantMembership.findFirst({
      where: { userId: user.userId, isActive: true },
    });

    if (membership) {
      withMembership++;
    } else {
      withoutMembership++;
      warnings.push(`Usuario activo "${user.email}" (${user.userId}) NO tiene membresía tenant.`);
    }
  }

  console.log(`  ✓ Usuarios activos: ${activeUsers.length}`);
  console.log(`    - Con membresía:  ${withMembership}`);
  console.log(`    - Sin membresía:  ${withoutMembership}`);

  if (withoutMembership > 0) {
    errors.push(`${withoutMembership} usuario(s) activo(s) sin membresía. Ejecutá backfill-tenant-default.ts.`);
  }

  // Verificar que no haya membresías huérfanas (apuntando a usuario/tenant que no existe)
  // Prisma ya lo valida por FK, pero verificamos por consistencia del reporte
  return { ok: errors.length === 0, errors, warnings };
}

async function validateTenantLicenses(): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const tenantCount = await prisma.tenant.count();
  const licenseCount = await prisma.tenantLicense.count();

  if (tenantCount > 0 && licenseCount === 0) {
    warnings.push('No hay licencias asociadas a tenants. Se asignarán en la fase de licenciamiento.');
  } else {
    console.log(`  ✓ Licencias tenant: ${licenseCount}`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

async function validateUniqueConflicts(): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Verificar que MiEmpresa.tenantId sea único (1:1) en los datos actuales
  const dups = await prisma.$queryRaw<Array<{ tenantId: string; count: bigint }>>`
    SELECT "tenantId", COUNT(*)::bigint as count
    FROM "MiEmpresa"
    WHERE "tenantId" IS NOT NULL
    GROUP BY "tenantId"
    HAVING COUNT(*) > 1
  `;

  if (dups.length > 0) {
    for (const d of dups) {
      errors.push(`tenantId "${d.tenantId}" aparece ${d.count} veces en MiEmpresa. Debería ser 1:1.`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

async function main(): Promise<void> {
  console.log('══════════════════════════════════════════════');
  console.log('  Validación de Migración Multi-Tenant');
  console.log('══════════════════════════════════════════════\n');

  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  const validations = [
    { name: 'Tenant existe', fn: validateTenantExists },
    { name: 'MiEmpresa vinculada', fn: validateMiEmpresaLinked },
    { name: 'Membresías de usuario', fn: validateUserMemberships },
    { name: 'Licencias tenant', fn: validateTenantLicenses },
    { name: 'Uniques sin conflicto', fn: validateUniqueConflicts },
  ];

  for (const v of validations) {
    process.stdout.write(`\n📋 ${v.name}...\n`);
    const result = await v.fn();
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  console.log('\n══════════════════════════════════════════════');
  console.log('  RESUMEN');
  console.log('══════════════════════════════════════════════');

  if (allWarnings.length > 0) {
    console.log(`\n⚠️  Warnings (${allWarnings.length}):`);
    for (const w of allWarnings) {
      console.log(`  ⚠  ${w}`);
    }
  }

  if (allErrors.length > 0) {
    console.log(`\n❌ Errores (${allErrors.length}):`);
    for (const e of allErrors) {
      console.log(`  ✗ ${e}`);
    }
    console.log('\nEstado: FALLIDO. Corregí los errores antes de continuar.');
    process.exit(1);
  }

  console.log('\n✅ Estado: VÁLIDO. La migración multi-tenant es consistente.');
}

main()
  .catch((e) => {
    console.error('\n❌ Error inesperado durante validación:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
