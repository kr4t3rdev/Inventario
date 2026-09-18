#!/usr/bin/env npx tsx
/**
 * @description Backfill de tenantId en modelos de auditoría inactivos (AS-05 ola 2).
 * Tablas: AlertHistory, ReportHistory, ScheduledReport, ScenarioSimulation.
 * Estos modelos no tienen escritores ni lectores en el código actual. No existe
 * vínculo resoluble al tenant: creadoPor/generadoPor son userId (un usuario
 * puede pertenecer a varios tenants) y entidadTipo/entidadId es polimórfico sin
 * writers que lo pueblen. El script solo cuenta filas con tenantId NULL y las
 * clasifica como huérfanas (fail-closed: quedan NULL, no se exponen bajo
 * enforcement). Con --apply y filas pendientes, se niega (requiere gate P-2 +
 * política de atribución); con cero filas, es no-op exitoso.
 *
 * @usage
 *   DATABASE_URL="postgresql://..." pnpm exec tsx scripts/backfill/dead-audit-models-tenant.ts            # dry-run
 *   DATABASE_URL="postgresql://..." pnpm exec tsx scripts/backfill/dead-audit-models-tenant.ts --apply    # validación
 */
import { prismaPlatform as prisma } from '../../src/lib/db/platform-prisma';

const apply = process.argv.includes('--apply');

/** @description Tablas de la ola 2 con su delegado y campo de id. */
const TABLES = [
  { name: 'AlertHistory', delegate: () => prisma.alertHistory, idField: 'id' },
  { name: 'ReportHistory', delegate: () => prisma.reportHistory, idField: 'id' },
  { name: 'ScheduledReport', delegate: () => prisma.scheduledReport, idField: 'id' },
  { name: 'ScenarioSimulation', delegate: () => prisma.scenarioSimulation, idField: 'id' },
] as const;

/**
 * @description Ejecuta el conteo dry-run (o validación --apply) y reporta.
 * @returns {Promise<void>} Resultado impreso.
 */
async function main(): Promise<void> {
  console.log(`=== Backfill modelos auditoría ola 2 (${apply ? 'APPLY' : 'DRY-RUN'}) ===`);
  let total = 0;
  for (const table of TABLES) {
    const rows = await (
      table.delegate() as unknown as {
        findMany: (args: unknown) => Promise<Array<{ id: string }>>;
      }
    ).findMany({
      where: { tenantId: null },
      select: { id: true },
      take: 11,
    });
    const count = await (
      table.delegate() as unknown as { count: (args: unknown) => Promise<number> }
    ).count({ where: { tenantId: null } });
    total += count;
    console.log(`${table.name}: pendientes=${count} resolubles=0 huérfanos=${count}`);
    for (const row of rows.slice(0, 10)) {
      console.log(`  - ${row.id}: huérfano (sin vínculo resoluble al tenant)`);
    }
    if (count > 10) console.log(`  ... y ${count - 10} más`);
  }
  console.log(`Total pendientes: ${total} (todas huérfanas por diseño)`);

  if (apply) {
    if (total > 0) {
      console.error(
        'APPLY rechazado: existen filas sin tenant atribuible. Requiere gate P-2 y política de atribución.',
      );
      await prisma.$disconnect();
      process.exitCode = 2;
      return;
    }
    console.log('Sin filas pendientes: no-op exitoso.');
  } else {
    console.log('(dry-run: sin cambios. --apply solo valida cero pendientes.)');
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Backfill falló:', error);
  process.exitCode = 1;
});
