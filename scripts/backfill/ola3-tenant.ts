#!/usr/bin/env npx tsx
/**
 * @description Backfill de tenantId en modelos ola 3 de AS-05 (InyeccionCapital, PagoDeuda, SaldoSnapshot).
 * Todos tienen parent chain resoluble:
 *   InyeccionCapital → cuentaBancaria.tenantId (1 hop)
 *   PagoDeuda → inyeccion → cuentaBancaria.tenantId (2 hops)
 *   SaldoSnapshot → periodo.tenantId (1 hop)
 * Dry-run: solo cuenta y muestra; --apply: actualiza.
 * Gate P-2: revisar el dry-run antes de ejecutar --apply.
 *
 * @usage
 *   DATABASE_URL="postgresql://..." pnpm exec tsx scripts/backfill/ola3-tenant.ts
 *   DATABASE_URL="postgresql://..." pnpm exec tsx scripts/backfill/ola3-tenant.ts --apply
 */
import { prismaPlatform as prisma } from '../../src/lib/db/platform-prisma';

const apply = process.argv.includes('--apply');

interface TableHarness {
  name: string;
  findManyPending: () => Promise<Array<{ id: string }>>;
  resolve: (id: string) => Promise<string | null>;
  update: (id: string, tenantId: string) => Promise<void>;
}

const TABLES: TableHarness[] = [
  {
    name: 'InyeccionCapital',
    findManyPending: () =>
      prisma.inyeccionCapital.findMany({ where: { tenantId: null }, select: { id: true } }),
    resolve: async (id) => {
      const row = await prisma.inyeccionCapital.findUnique({
        where: { id },
        select: { cuentaBancaria: { select: { tenantId: true } } },
      });
      return row?.cuentaBancaria?.tenantId ?? null;
    },
    update: async (id, tenantId) =>
      void (await prisma.inyeccionCapital.update({ where: { id }, data: { tenantId } })),
  },
  {
    name: 'PagoDeuda',
    findManyPending: () =>
      prisma.pagoDeuda.findMany({ where: { tenantId: null }, select: { id: true } }),
    resolve: async (id) => {
      const row = await prisma.pagoDeuda.findUnique({
        where: { id },
        select: {
          inyeccion: { select: { cuentaBancaria: { select: { tenantId: true } } } },
        },
      });
      return row?.inyeccion?.cuentaBancaria?.tenantId ?? null;
    },
    update: async (id, tenantId) =>
      void (await prisma.pagoDeuda.update({ where: { id }, data: { tenantId } })),
  },
  {
    name: 'SaldoSnapshot',
    findManyPending: () =>
      prisma.saldoSnapshot.findMany({ where: { tenantId: null }, select: { snapshotId: true } }),
    resolve: async (snapshotId) => {
      const row = await prisma.saldoSnapshot.findUnique({
        where: { snapshotId },
        select: { periodo: { select: { tenantId: true } } },
      });
      return row?.periodo?.tenantId ?? null;
    },
    update: async (snapshotId, tenantId) =>
      void (await prisma.saldoSnapshot.update({ where: { snapshotId }, data: { tenantId } })),
  },
];

async function main(): Promise<void> {
  console.log(`=== Backfill ola 3 AS-05 (${apply ? 'APPLY' : 'DRY-RUN'}) ===`);
  let totalResolubles = 0;
  let totalHuerfanos = 0;
  const allSamples: Array<{ table: string; id: string; tenantId: string | null }> = [];

  for (const table of TABLES) {
    const pending = await table.findManyPending();
    let resolubles = 0;
    let huerfanos = 0;
    const updates: Array<{ id: string; tenantId: string }> = [];

    for (const row of pending) {
      const tenantId = await table.resolve(row.id);
      if (tenantId) {
        resolubles++;
        updates.push({ id: row.id, tenantId });
      } else {
        huerfanos++;
        if (allSamples.length < 15) {
          allSamples.push({ table: table.name, id: row.id, tenantId: null });
        }
      }
    }

    totalResolubles += resolubles;
    totalHuerfanos += huerfanos;
    console.log(`${table.name}: pendientes=${pending.length} resolubles=${resolubles} huérfanos=${huerfanos}`);

    if (apply && updates.length > 0) {
      for (const u of updates) {
        await table.update(u.id, u.tenantId);
      }
      console.log(`  → ${updates.length} filas actualizadas`);
    }
  }

  console.log(`\nTotal: resolubles=${totalResolubles} huérfanos=${totalHuerfanos}`);
  if (allSamples.length > 0) {
    console.log('Muestras huérfanas:');
    for (const s of allSamples) console.log(`  - ${s.table} ${s.id}`);
  }
  if (!apply) console.log('(dry-run: sin cambios. Usa --apply tras revisar.)');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Backfill falló:', error);
  process.exitCode = 1;
});
