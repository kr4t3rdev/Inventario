/**
 * @description Elimina los tenants basura del feature de pruebas de
 *              generación de EAN-13. Son ~23 tenants sin usuarios
 *              activos, con productos de prueba EAN-13.
 *
 *              USO:
 *                # 1) Dry-run (NO borra, sólo muestra qué haría)
 *                pnpm exec tsx scripts/cleanup-ean13-test-tenants.ts
 *
 *                # 2) Borrado real
 *                CONFIRM_DELETE=1 pnpm exec tsx scripts/cleanup-ean13-test-tenants.ts
 *
 *              ESTRATEGIA:
 *                - Identifica los tenants basura (nombre "Tenant EAN13" +
 *                  0 memberships activas)
 *                - Construye un único statement SQL que:
 *                  1) Borra filas de TODAS las tablas con FK a tenant
 *                  2) Borra el tenant
 *                - Un statement por tenant, fuera de transacción.
 *                - Si FK de tabla no tiene CASCADE, la query falla
 *                  y la saltamos (luego se borra manual).
 */
import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

const EAN13_TENANT_NAME_PREFIX = 'Tenant EAN13'
const CONFIRM_REQUIRED = process.env.CONFIRM_DELETE === '1'

async function getReferencingTables(): Promise<string[]> {
  const rows: Array<{ table_name: string }> = await prisma.$queryRaw`
    SELECT DISTINCT tc.table_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'tenants'
      AND ccu.column_name = 'tenantId'
    ORDER BY tc.table_name
  `
  return rows.map((r) => r.table_name).filter((t) => t !== 'tenants')
}

async function main() {
  const isDryRun = !CONFIRM_REQUIRED
  console.log(`\n${'═'.repeat(60)}`)
  console.log(
    ` MODO: ${isDryRun ? '🟡 DRY-RUN (no se borra nada)' : '🔴 BORRADO REAL'}`,
  )
  console.log(`${'═'.repeat(60)}\n`)

  // 1. Identificar candidatos
  const candidatos = await prisma.tenant.findMany({
    where: {
      nombre: { startsWith: EAN13_TENANT_NAME_PREFIX },
      memberships: { none: { isActive: true } },
    },
    select: { tenantId: true, nombre: true, slug: true },
  })

  if (candidatos.length === 0) {
    console.log(
      '✅ No hay tenants "Tenant EAN13" sin usuarios activos. Nada que limpiar.\n',
    )
    await prisma.$disconnect()
    return
  }

  const refTables = await getReferencingTables()
  console.log(
    `📋 Candidatos a eliminar: ${candidatos.length}\n` +
      `🔧 Tablas con FK a tenant: ${refTables.length}\n`,
  )

  let deletedTenants = 0
  let totalRowsDeleted = 0
  let errors = 0

  for (const t of candidatos) {
    console.log(`─── ${t.nombre} (${t.tenantId})`)

    if (isDryRun) {
      console.log(`    [dry-run] no se borró nada\n`)
      continue
    }

    try {
      // Crear (si no existe) una función PL/pgSQL que limpia un tenant entero.
      // Ejecuta DELETE contra cada tabla con FK a tenant + DELETE del tenant.
      // Retorna el número de filas eliminadas en total.
      const funcSql = `
        CREATE OR REPLACE FUNCTION cleanup_tenant(p_tenant_id TEXT)
        RETURNS INTEGER AS $$
        DECLARE
          total INTEGER := 0;
          tbl TEXT;
          deleted INTEGER;
        BEGIN
          FOREACH tbl IN ARRAY ARRAY[
            ${refTables.map((t) => `'${t}'::text`).join(', ')}
          ]
          LOOP
            EXECUTE format('DELETE FROM %I WHERE "tenantId" = $1', tbl)
              USING p_tenant_id;
            GET DIAGNOSTICS deleted = ROW_COUNT;
            total := total + deleted;
          END LOOP;
          DELETE FROM tenants WHERE "tenantId" = p_tenant_id;
          GET DIAGNOSTICS deleted = ROW_COUNT;
          total := total + deleted;
          RETURN total;
        END;
        $$ LANGUAGE plpgsql;
      `

      await prisma.$executeRawUnsafe(funcSql)

      // Llamar la función
      const result: Array<{ cleanup_tenant: number }> = await prisma.$queryRawUnsafe(
        `SELECT cleanup_tenant($1) AS cleanup_tenant`,
        t.tenantId,
      )
      const rowsCount = Number(result[0]?.cleanup_tenant ?? 0)

      totalRowsDeleted += rowsCount
      deletedTenants++
      console.log(`    ✓ ${rowsCount} filas/registros eliminados (incluye tenant)\n`)
    } catch (error) {
      errors++
      console.error(
        `    ✗ Error:`,
        error instanceof Error ? error.message : String(error),
      )
      console.log()
    }
  }

  console.log(`${'═'.repeat(60)}`)
  console.log(' RESUMEN')
  console.log(`${'═'.repeat(60)}`)
  if (isDryRun) {
    console.log(`Modo: DRY-RUN — no se borró nada`)
    console.log(`Para borrar de verdad, corré:`)
    console.log(
      `  CONFIRM_DELETE=1 pnpm exec tsx scripts/cleanup-ean13-test-tenants.ts`,
    )
  } else {
    console.log(`Tenants eliminados:    ${deletedTenants}`)
    console.log(`Filas relacionadas:    ${totalRowsDeleted}`)
    console.log(`Errores:               ${errors}`)
  }
  console.log()

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('Fatal:', e)
  await prisma.$disconnect()
  process.exit(1)
})
