/**
 * @description Post-deploy fix: corrige la sequence de MiEmpresa.id
 *   y limpia registros huérfanos (tenantId = NULL) después del cambio
 *   de @default(1) a @default(autoincrement()).
 *
 * Uso:
 *   railway run node scripts/fix-mi-empresa-sequence.cjs
 */

const { Client } = require('pg');

async function main() {
  console.log('[fix-mi-empresa-sequence] Iniciando...\n');

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('  ✅ Conectado a la base de datos\n');

  try {
    // ── 1. Resetear la sequence ──
    console.log('[1/3] Reseteando sequence miempresa_id_seq...');
    await client.query(`
      SELECT setval(
        'miempresa_id_seq',
        COALESCE((SELECT MAX(id) FROM "MiEmpresa"), 0) + 1,
        false
      );
    `);
    console.log('  ✓ Sequence reseteada a max(id) + 1\n');

    // ── 2. Huérfanos sin tenantId ──
    console.log('[2/3] Buscando registros huérfanos (tenantId IS NULL)...');
    const orphans = await client.query(
      'SELECT id, nombre, "createdAt" FROM "MiEmpresa" WHERE "tenantId" IS NULL ORDER BY id'
    );

    if (orphans.rows.length === 0) {
      console.log('  ✓ No hay registros huérfanos\n');
    } else {
      console.log(`  ⚠  ${orphans.rows.length} registro(s) huérfano(s):`);
      for (const o of orphans.rows) {
        console.log(`    - id=${o.id} "${o.nombre}" (${o.createdAt})`);
      }

      // Asignar al primer tenant cronológico
      const firstTenant = await client.query(
        'SELECT "tenantId", nombre FROM "tenants" ORDER BY "createdAt" ASC LIMIT 1'
      );

      if (firstTenant.rows.length > 0) {
        const t = firstTenant.rows[0];
        console.log(`\n  Asignando al primer tenant: "${t.nombre}"...`);
        for (const o of orphans.rows) {
          await client.query(
            'UPDATE "MiEmpresa" SET "tenantId" = $1 WHERE id = $2',
            [t.tenantId, o.id]
          );
          console.log(`  ✓ id=${o.id} → tenantId=${t.tenantId}`);
        }
      } else {
        console.log('\n  ⚠  No hay tenants para asignar. Quedan con tenantId=NULL.');
      }
      console.log('');
    }

    // ── 3. Duplicados de tenantId ──
    console.log('[3/3] Verificando duplicados de tenantId...');
    const dups = await client.query(`
      SELECT "tenantId", COUNT(*)::int as count
      FROM "MiEmpresa"
      WHERE "tenantId" IS NOT NULL
      GROUP BY "tenantId"
      HAVING COUNT(*) > 1
    `);

    if (dups.rows.length === 0) {
      console.log('  ✓ No hay tenantId duplicados\n');
    } else {
      console.log(`  ⚠  ${dups.rows.length} tenant(s) con múltiples filas:`);
      for (const d of dups.rows) {
        console.log(`    - tenantId=${d.tenantId} aparece ${d.count} veces`);
      }
      console.log('  Eliminando duplicados, manteniendo el registro más antiguo...');
      for (const d of dups.rows) {
        await client.query(`
          DELETE FROM "MiEmpresa"
          WHERE "tenantId" = $1
            AND id NOT IN (
              SELECT id FROM "MiEmpresa"
              WHERE "tenantId" = $1
              ORDER BY "createdAt" ASC
              LIMIT 1
            )
        `, [d.tenantId]);
        console.log(`  ✓ Duplicados de tenantId=${d.tenantId} eliminados`);
      }
      console.log('');
    }

    console.log('[fix-mi-empresa-sequence] Completado.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[fix-mi-empresa-sequence] ERROR:', err);
  process.exit(1);
});
