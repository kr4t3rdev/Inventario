#!/usr/bin/env npx tsx
/**
 * @description Backfill de tenantId en TransaccionMoneda (AS-05 T.2).
 * Deriva el tenant desde la tabla padre según tipoTransaccion:
 *   venta            -> Venta(ventaId)
 *   servicio         -> VentaServicios(ventaServicioId)
 *   servicio_egreso  -> CompraServicio(compraServicioId)
 *   gasto            -> polimórfico: GastosDE/GastoCompra/Pagosalario/CompraServicio/VentaServicios
 *   exchange         -> irresoluble (referenciaId UUID de request sin padre)
 * Reporta conteos resolubles/ambigüos/huérfanos/irresolubles. En dry-run solo
 * cuenta y muestra; con --apply actualiza. Gate P-2: revisar el dry-run antes
 * de ejecutar --apply.
 *
 * @usage
 *   pnpm exec tsx scripts/backfill/transaccion-moneda-tenant.ts            # dry-run
 *   pnpm exec tsx scripts/backfill/transaccion-moneda-tenant.ts --apply    # backfill real
 */
import { prismaPlatform as prisma } from '../../src/lib/db/platform-prisma';

const apply = process.argv.includes('--apply');

/** @description Mapeo tipoTransaccion -> tablas candidatas (campo de id, modelo Prisma). */
const RESOLVERS: Record<
  string,
  Array<{ idField: string; find: (ref: string) => Promise<{ tenantId: string } | null> }>
> = {
  venta: [
    {
      idField: 'ventaId',
      find: (ref) => prisma.venta.findUnique({ where: { ventaId: ref }, select: { tenantId: true } }),
    },
  ],
  servicio: [
    {
      idField: 'ventaServicioId',
      find: (ref) =>
        prisma.ventaServicios.findUnique({ where: { ventaServicioId: ref }, select: { tenantId: true } }),
    },
  ],
  servicio_egreso: [
    {
      idField: 'compraServicioId',
      find: (ref) =>
        prisma.compraServicio.findUnique({ where: { compraServicioId: ref }, select: { tenantId: true } }),
    },
  ],
  gasto: [
    {
      idField: 'gastosDEId',
      find: (ref) => prisma.gastosDE.findUnique({ where: { gastosDEId: ref }, select: { tenantId: true } }),
    },
    {
      idField: 'gastoCompraId',
      find: (ref) =>
        prisma.gastoCompra.findUnique({ where: { gastoCompraId: ref }, select: { tenantId: true } }),
    },
    {
      idField: 'pgId',
      find: (ref) =>
        prisma.pagosalario.findUnique({ where: { pgId: ref }, select: { tenantId: true } }),
    },
    {
      idField: 'compraServicioId',
      find: (ref) =>
        prisma.compraServicio.findUnique({ where: { compraServicioId: ref }, select: { tenantId: true } }),
    },
    {
      idField: 'ventaServicioId',
      find: (ref) =>
        prisma.ventaServicios.findUnique({ where: { ventaServicioId: ref }, select: { tenantId: true } }),
    },
  ],
  exchange: [],
};

/**
 * @description Resuelve el tenant de una fila por tipoTransaccion.
 * @param {string} tipo - Tipo de transacción.
 * @param {string} referenciaId - Id de referencia.
 * @returns {Promise<{ tenantId: string; ambiguous: boolean } | null>} Tenant resuelto, null si huérfano.
 */
async function resolveTenant(
  tipo: string,
  referenciaId: string,
): Promise<{ tenantId: string; ambiguous: boolean } | null> {
  const resolvers = RESOLVERS[tipo];
  if (!resolvers || resolvers.length === 0) return null;
  const found: string[] = [];
  for (const resolver of resolvers) {
    const row = await resolver.find(referenciaId);
    if (row?.tenantId && !found.includes(row.tenantId)) found.push(row.tenantId);
    if (found.length > 1) break;
  }
  if (found.length === 0) return null;
  if (found.length > 1) return { tenantId: found[0], ambiguous: true };
  return { tenantId: found[0], ambiguous: false };
}

/**
 * @description Ejecuta el backfill (dry-run o real) y reporta conteos.
 * @returns {Promise<void>} Resultado impreso.
 */
async function main(): Promise<void> {
  const pending = await prisma.transaccionMoneda.findMany({
    where: { tenantId: null },
    orderBy: { createdAt: 'asc' },
    select: { transaccionId: true, tipoTransaccion: true, referenciaId: true },
  });

  const stats = { total: pending.length, resolubles: 0, ambiguos: 0, huerfanos: 0, irresolubles: 0 };
  const byType = new Map<string, number>();
  const byTypeUnresolved = new Map<string, number>();
  const samples: Array<{ transaccionId: string; tipo: string; ref: string; detalle: string }> = [];
  const updates = new Map<string, string>();

  for (const row of pending) {
    byType.set(row.tipoTransaccion, (byType.get(row.tipoTransaccion) ?? 0) + 1);
    if (!RESOLVERS[row.tipoTransaccion] || RESOLVERS[row.tipoTransaccion].length === 0) {
      stats.irresolubles += 1;
      byTypeUnresolved.set(row.tipoTransaccion, (byTypeUnresolved.get(row.tipoTransaccion) ?? 0) + 1);
      continue;
    }
    const resolved = await resolveTenant(row.tipoTransaccion, row.referenciaId);
    if (!resolved) {
      stats.huerfanos += 1;
      byTypeUnresolved.set(row.tipoTransaccion, (byTypeUnresolved.get(row.tipoTransaccion) ?? 0) + 1);
      if (samples.length < 10) {
        samples.push({ transaccionId: row.transaccionId, tipo: row.tipoTransaccion, ref: row.referenciaId, detalle: 'huérfano (padre no encontrado)' });
      }
    } else if (resolved.ambiguous) {
      stats.ambiguos += 1;
      byTypeUnresolved.set(row.tipoTransaccion, (byTypeUnresolved.get(row.tipoTransaccion) ?? 0) + 1);
      if (samples.length < 10) {
        samples.push({ transaccionId: row.transaccionId, tipo: row.tipoTransaccion, ref: row.referenciaId, detalle: 'ambigüo (>1 padre posible)' });
      }
    } else {
      stats.resolubles += 1;
      updates.set(row.transaccionId, resolved.tenantId);
    }
  }

  console.log(`=== Backfill TransaccionMoneda (${apply ? 'APPLY' : 'DRY-RUN'}) ===`);
  console.log(`Total pendientes (tenantId NULL): ${stats.total}`);
  console.log(`  resolubles   : ${stats.resolubles}`);
  console.log(`  ambiguos     : ${stats.ambiguos}`);
  console.log(`  huérfanos    : ${stats.huerfanos}`);
  console.log(`  irresolubles : ${stats.irresolubles} (tipo sin padre: exchange)`);
  console.log(`Por tipo: ${[...byType.entries()].map(([t, c]) => `${t}=${c}`).join(', ')}`);
  console.log(`Por tipo no resueltos: ${[...byTypeUnresolved.entries()].map(([t, c]) => `${t}=${c}`).join(', ')}`);
  if (samples.length > 0) {
    console.log('Muestras no resueltas:');
    for (const s of samples) console.log(`  - ${s.tipo} ${s.ref}: ${s.detalle}`);
  }

  if (apply) {
    let applied = 0;
    const entries = [...updates.entries()];
    const batchSize = 500;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      for (const [transaccionId, tenantId] of batch) {
        const res = await prisma.transaccionMoneda.updateMany({
          where: { transaccionId, tenantId: null },
          data: { tenantId },
        });
        applied += res.count;
      }
    }
    console.log(`Actualizadas: ${applied}`);
  } else {
    console.log('(dry-run: sin cambios. Usa --apply tras revisar el conteo.)');
  }

  await prisma.$disconnect();
  if (apply && stats.huerfanos + stats.ambiguos + stats.irresolubles > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error('Backfill falló:', error);
  process.exitCode = 1;
});