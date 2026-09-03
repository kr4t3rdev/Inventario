#!/usr/bin/env npx tsx
/**
 * @description Detector de reconciliaciones históricas contaminadas (fase MM-4.5).
 * Lee la base de datos y clasifica filas de ReconciliacionServicio como
 * contaminadas, para revisión manual antes de cualquier write.
 * SOLO LEE — no escribe nada.
 *
 * @usage pnpm exec tsx scripts/accounting/fx-contamination-report.ts [--tenant <id>]
 */
import { prisma } from '@/lib/prisma';
import { detectContaminatedReconciliaciones, type ReconciliacionSnapshot } from './fx-contamination-detector';

async function extractSnapshots(tenantId?: string): Promise<ReconciliacionSnapshot[]> {
  const rows = await prisma.reconciliacionServicio.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      observaciones: { contains: 'Anticipo' },
    },
    select: {
      reconciliacionId: true,
      moneda: true,
      monto: true,
      observaciones: true,
      reconciliadoPor: true,
      ventaServicioId: true,
    },
  });

  const ventaIds = [...new Set(rows.map((r) => r.ventaServicioId))];
  if (ventaIds.length === 0) return [];

  // La moneda del dinero movido vive en AnticipoMovimiento.moneda (el anticipo
  // siempre se ejecuta en su propia moneda).
  const movimientos = await prisma.anticipoMovimiento.findMany({
    where: {
      documentoDestinoId: { in: ventaIds },
      tipoMovimiento: 'EJECUCION',
    },
    select: { documentoDestinoId: true, moneda: true },
  });

  const monedasPorVenta = new Map(movimientos.map((m) => [m.documentoDestinoId!, m.moneda]));

  return rows.map((r) => ({
    reconciliacionId: r.reconciliacionId,
    moneda: r.moneda,
    anticipoMoneda: monedasPorVenta.get(r.ventaServicioId) ?? '',
    monto: Number(r.monto),
    tipo: r.observaciones ?? '',
    reconciliadoPor: r.reconciliadoPor,
  }));
}

async function main() {
  const args = process.argv;
  const tenantIdx = args.indexOf('--tenant');
  const tenantId = tenantIdx >= 0 ? args[tenantIdx + 1] : undefined;

  console.log('Buscando reconciliaciones contaminadas (read-only)...');
  if (tenantId) console.log(`Filtro por tenant: ${tenantId}\n`);

  const snapshots = await extractSnapshots(tenantId);
  if (snapshots.length === 0) {
    console.log('No se encontraron filas de reconciliación de anticipos.');
    return;
  }

  const report = detectContaminatedReconciliaciones(snapshots);

  console.log(`Total filas revisadas: ${report.total}`);
  console.log(`Limpias: ${report.clean.length}`);
  console.log(`Contaminadas: ${report.contaminated.length}\n`);

  if (report.contaminated.length > 0) {
    console.log('=== FILAS SOSPECHOSAS (no se tocan; solo se reportan) ===');
    for (const c of report.contaminated) {
      console.log(`  ${c.deteccion}: ${c.reconciliacionId}  fila=${c.monedaFila}  anticipo=${c.monedaAnticipo}  tipo=${c.tipo}  monto=${c.monto}`);
    }
    console.log('\nRevisa cada fila manualmente antes de actuar.');
  } else {
    console.log('Sin filas contaminadas.');
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
