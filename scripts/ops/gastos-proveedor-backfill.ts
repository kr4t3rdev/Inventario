/**
 * @description Backfill B-04: vincula gastos históricos a proveedores del catálogo.
 *
 * Empareja `GastosDE.proveedor` (texto) con `Vendor.nombre` por tenant
 * (coincidencia exacta sin distinción de mayúsculas, con trim). Reporta
 * resueltos, ambiguos (más de un vendor con ese nombre) y sin match.
 *
 * Uso (con el entorno del ambiente objetivo):
 *   pnpm exec tsx scripts/ops/gastos-proveedor-backfill.ts          # dry-run
 *   pnpm exec tsx scripts/ops/gastos-proveedor-backfill.ts --apply  # aplica
 */
import { PrismaClient } from '../../src/generated/prisma';

const APPLY = process.argv.includes('--apply');

const prisma = new PrismaClient();

async function main() {
  const gastos = await prisma.gastosDE.findMany({
    where: { proveedorId: null },
    select: { gastosDEId: true, tenantId: true, proveedor: true },
  });

  if (gastos.length === 0) {
    console.log('Nada que vincular: no hay gastos sin proveedorId.');
    return;
  }

  const vendors = await prisma.vendor.findMany({
    select: { vendorId: true, tenantId: true, nombre: true },
  });

  // Índice nombre-normalizado por tenant → lista de vendors (para detectar ambigüedad).
  const indice = new Map<string, Array<{ vendorId: string }>>();
  for (const v of vendors) {
    const key = `${v.tenantId}::${v.nombre.trim().toLowerCase()}`;
    const lista = indice.get(key) ?? [];
    lista.push({ vendorId: v.vendorId });
    indice.set(key, lista);
  }

  let resueltos = 0;
  let ambiguos = 0;
  let sinMatch = 0;
  const updates: Array<{ gastosDEId: string; vendorId: string }> = [];

  for (const g of gastos) {
    const key = `${g.tenantId}::${(g.proveedor ?? '').trim().toLowerCase()}`;
    const candidatos = indice.get(key) ?? [];
    if (candidatos.length === 1) {
      resueltos++;
      updates.push({ gastosDEId: g.gastosDEId, vendorId: candidatos[0].vendorId });
    } else if (candidatos.length > 1) {
      ambiguos++;
      console.log(`AMBIGUO: gasto ${g.gastosDEId} → "${g.proveedor}" tiene ${candidatos.length} vendors (se omite, revisar manual)`);
    } else {
      sinMatch++;
      console.log(`SIN MATCH: gasto ${g.gastosDEId} → "${g.proveedor}" (queda como texto libre)`);
    }
  }

  console.log(`\nTotal: ${gastos.length} | resueltos: ${resueltos} | ambiguos: ${ambiguos} | sin match: ${sinMatch}`);

  if (!APPLY) {
    console.log('Dry-run: nada escrito. Re-ejecutar con --apply para aplicar.');
    return;
  }

  let aplicados = 0;
  for (const u of updates) {
    await prisma.gastosDE.update({
      where: { gastosDEId: u.gastosDEId },
      data: { proveedorId: u.vendorId },
    });
    aplicados++;
  }
  console.log(`Aplicados: ${aplicados}`);
}

main()
  .catch((error) => {
    console.error('Fallo en backfill:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
