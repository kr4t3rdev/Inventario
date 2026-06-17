/**
 * @description Auditoría: detecta ventas con `total = null` o con inconsistencias
 *   entre `venta.total` y `sum(venta.items.total)`.
 *
 *   Usado durante el fix #4 del feature Balance y Resultados para validar en
 *   producción que la nueva lógica (que prioriza `sum(items.total)` sobre
 *   `venta.total`) no sub-registraría ingresos.
 *
 *   Uso:
 *     pnpm tsx scripts/audit-ventas-total-null.ts
 */

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("=".repeat(70));
  console.log("AUDITORÍA: Ventas con `total = null` o inconsistencias");
  console.log("=".repeat(70));

  // 1. Total de ventas
  const totalVentas = await prisma.venta.count();
  console.log(`\nTotal de ventas en el sistema: ${totalVentas}`);

  // 2. Ventas con total = null
  const ventasSinTotal = await prisma.venta.count({
    where: { total: null },
  });
  console.log(`Ventas con total = NULL:        ${ventasSinTotal}`);

  // 3. Ventas con total = 0 (sospechoso pero válido en algunos casos)
  const ventasConTotalCero = await prisma.venta.count({
    where: { total: 0 },
  });
  console.log(`Ventas con total = 0:           ${ventasConTotalCero}`);

  // 4. Ventas con items vs sin items
  const ventasConItems = await prisma.venta.count({
    where: { items: { some: {} } },
  });
  const ventasSinItems = totalVentas - ventasConItems;
  console.log(`Ventas con al menos 1 item:     ${ventasConItems}`);
  console.log(`Ventas SIN items (legacy):      ${ventasSinItems}`);

  // 5. Muestra de las primeras 5 ventas con total = null
  if (ventasSinTotal > 0) {
    console.log(`\n${"─".repeat(70)}`);
    console.log("Muestra de las primeras 5 ventas con total = NULL:");
    console.log("─".repeat(70));
    const sample = await prisma.venta.findMany({
      where: { total: null },
      take: 5,
      select: {
        ventaId: true,
        cantidad: true,
        createdAt: true,
        tenantId: true,
        items: { select: { id: true, total: true, cantidad: true } },
      },
    });
    for (const v of sample) {
      const itemsTotal = v.items.reduce((s, i) => s + i.total, 0);
      console.log(`  ${v.ventaId}`);
      console.log(`    fecha: ${v.createdAt.toISOString().slice(0, 10)}`);
      console.log(`    cantidad (legacy): ${v.cantidad}`);
      console.log(`    items: ${v.items.length} (sum total = ${itemsTotal})`);
    }
  }

  // 6. Inconsistencias: venta.total ≠ sum(items.total) para ventas con items
  console.log(`\n${"─".repeat(70)}`);
  console.log("Buscando inconsistencias entre venta.total y sum(items.total)...");
  console.log("─".repeat(70));

  const ventasConItemsLista = await prisma.venta.findMany({
    where: { items: { some: {} }, total: { not: null } },
    select: {
      ventaId: true,
      total: true,
      createdAt: true,
      items: { select: { total: true } },
    },
    take: 1000, // muestra, no exhaustivo
  });

  const inconsistencias = ventasConItemsLista.filter((v) => {
    const itemsTotal = v.items.reduce((s, i) => s + i.total, 0);
    return v.total !== itemsTotal;
  });

  console.log(`Ventas con items revisadas:      ${ventasConItemsLista.length}`);
  console.log(`Inconsistencias detectadas:      ${inconsistencias.length}`);

  if (inconsistencias.length > 0) {
    console.log(`\nMuestra de las primeras 5 inconsistencias:`);
    for (const v of inconsistencias.slice(0, 5)) {
      const itemsTotal = v.items.reduce((s, i) => s + i.total, 0);
      console.log(`  ${v.ventaId} (${v.createdAt.toISOString().slice(0, 10)})`);
      console.log(`    venta.total:   ${v.total}`);
      console.log(`    sum(items):    ${itemsTotal}`);
      console.log(`    diferencia:    ${(v.total ?? 0) - itemsTotal}`);
    }
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log("RESUMEN EJECUTIVO");
  console.log("=".repeat(70));
  if (ventasSinTotal === 0 && inconsistencias.length === 0) {
    console.log("✅ NO hay ventas con total = NULL ni inconsistencias.");
    console.log("   Es seguro eliminar el fallback `v.total ?? precioVenta*cantidad`.");
  } else if (ventasSinTotal > 0) {
    console.log(`⚠️  Hay ${ventasSinTotal} ventas con total = NULL.`);
    console.log("   El fix #4 DEBE manejar este caso (no eliminarse a ciegas).");
  } else {
    console.log(`⚠️  Hay ${inconsistencias.length} inconsistencias entre venta.total y sum(items.total).`);
    console.log("   Decidir qué fuente priorizar antes de aplicar el fix.");
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
