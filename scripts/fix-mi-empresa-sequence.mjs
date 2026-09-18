/**
 * @description Post-deploy fix: corrige la sequence de MiEmpresa.id
 *   y limpia registros huérfanos (tenantId: null) después del cambio
 *   de @default(1) a @default(autoincrement()).
 *
 * Uso:
 *   railway run node scripts/fix-mi-empresa-sequence.mjs
 *
 * Railway ya tiene DATABASE_URL en entorno, el script la usa directo.
 */

import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function main() {
  console.log('[fix-mi-empresa-sequence] Iniciando...\n');

  // ── 1. Resetear la sequence de id ──
  console.log('[1/3] Reseteando sequence MiEmpresa_id_seq...');
  await prisma.$executeRawUnsafe(`
    SELECT setval(
      '"MiEmpresa_id_seq"',
      COALESCE((SELECT MAX(id) FROM "MiEmpresa"), 0) + 1,
      false
    );
  `);
  console.log('  ✓ Sequence reseteada a max(id) + 1\n');

  // ── 2. Buscar registros sin tenantId ──
  console.log('[2/3] Buscando registros huérfanos (tenantId = NULL)...');
  const orphans = await prisma.miEmpresa.findMany({
    where: { tenantId: null },
    select: { id: true, nombre: true, createdAt: true },
  });

  if (orphans.length === 0) {
    console.log('  ✓ No hay registros huérfanos\n');
  } else {
    console.log(`  ⚠  ${orphans.length} registro(s) huérfano(s):`);
    for (const o of orphans) {
      console.log(`    - id=${o.id} "${o.nombre}" (${o.createdAt.toISOString()})`);
    }

    // Asignar al primer tenant cronológico si existe
    const firstTenant = await prisma.tenant.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { tenantId: true, nombre: true },
    });

    if (firstTenant) {
      console.log(`\n  Asignando al primer tenant: "${firstTenant.nombre}"...`);
      for (const o of orphans) {
        await prisma.miEmpresa.update({
          where: { id: o.id },
          data: { tenantId: firstTenant.tenantId },
        });
        console.log(`  ✓ id=${o.id} → tenantId=${firstTenant.tenantId}`);
      }
    } else {
      console.log('\n  ⚠  No hay tenants para asignar. Los registros quedan con tenantId=NULL.');
    }
    console.log('');
  }

  // ── 3. Verificar duplicados de tenantId ──
  console.log('[3/3] Verificando duplicados de tenantId...');
  const dups = await prisma.$queryRawUnsafe`
    SELECT "tenantId", COUNT(*)::int as count
    FROM "MiEmpresa"
    WHERE "tenantId" IS NOT NULL
    GROUP BY "tenantId"
    HAVING COUNT(*) > 1
  `;

  if (dups.length === 0) {
    console.log('  ✓ No hay tenantId duplicados\n');
  } else {
    console.log(`  ⚠  ${dups.length} tenant(s) con múltiples filas:`);
    for (const d of dups) {
      console.log(`    - tenantId=${d.tenantId} aparece ${d.count} veces`);
    }
    console.log('');
  }

  console.log('[fix-mi-empresa-sequence] Completado.');
}

main()
  .catch((e) => {
    console.error('[fix-mi-empresa-sequence] ERROR:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
