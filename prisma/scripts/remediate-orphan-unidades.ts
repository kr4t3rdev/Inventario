/**
 * @description Script de remediación para unidades huérfanas (sin tenantId).
 *
 *   Los seeds antiguos creaban registros de Unidad sin asignar tenantId,
 *   lo que violaba el constraint NOT NULL del schema y/o dejaba unidades
 *   "huérfanas" que aparecían como datos de otros tenants al hacer JOINs
 *   o al listar unidades con `where: { tenantId: <actual> }`.
 *
 *   Este script:
 *   1. Detecta unidades sin tenantId o con tenantId inválido (no existe en Tenant)
 *   2. Intenta resolver el tenantId correcto por:
 *      a) Patrón del unidadId (mapeo seed → tenant)
 *      b) Productos que la referencian (mayoría de tenantId gana)
 *   3. En modo DRY-RUN muestra lo que haría.
 *   4. En modo --fix aplica los cambios en una transacción.
 *
 *   USO:
 *     npx tsx prisma/scripts/remediate-orphan-unidades.ts          # dry-run
 *     npx tsx prisma/scripts/remediate-orphan-unidades.ts --fix    # corregir
 *
 * @module prisma/scripts/remediate-orphan-unidades
 */

import { prisma } from '../../src/lib/prisma';

// ─── Mapeo de patrones de seed → tenantId ─────────────────

const SEED_PATTERN_TENANT: Array<{ pattern: RegExp; tenantId: string; descripcion: string }> = [
  { pattern: /^unid_hist_/, tenantId: 'historical-tenant', descripcion: 'historical-seed' },
  { pattern: /^und_impl_/, tenantId: 'demo-tenant', descripcion: 'implementation-seed' },
  { pattern: /^e2e-unidad-/, tenantId: 'e2e-tenant', descripcion: 'e2e-seed' },
];

interface UnidadHuerfana {
  unidadId: string;
  nombre: string;
  simbolo: string;
  tenantIdActual: string | null;
  tenantIdResuelto: string | null;
  fuente: 'pattern' | 'productos' | 'manual' | 'desconocida';
}

/**
 * @description Resuelve el tenantId correcto para una unidad huérfana.
 *
 *   Prioridad:
 *   1. Patrón del unidadId (más confiable, viene del seed original)
 *   2. TenantId de los productos que la referencian
 *   3. null (no se puede resolver automáticamente)
 */
async function resolverTenantId(unidad: {
  unidadId: string;
  tenantId: string | null;
}): Promise<{ tenantId: string | null; fuente: UnidadHuerfana['fuente'] }> {
  // 1. Intentar por patrón de seed
  for (const { pattern, tenantId } of SEED_PATTERN_TENANT) {
    if (pattern.test(unidad.unidadId)) {
      return { tenantId, fuente: 'pattern' };
    }
  }

  // 2. Intentar por productos que la referencian
  const productos = await prisma.producto.findMany({
    where: { unidadId: unidad.unidadId },
    select: { tenantId: true },
  });

  if (productos.length > 0) {
    const counts = new Map<string, number>();
    for (const p of productos) {
      counts.set(p.tenantId, (counts.get(p.tenantId) ?? 0) + 1);
    }
    // Ganar el tenantId con más productos
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0]) {
      return { tenantId: sorted[0][0], fuente: 'productos' };
    }
  }

  return { tenantId: null, fuente: 'desconocida' };
}

async function main() {
  const args = process.argv.slice(2);
  const modoFix = args.includes('--fix');

  console.log('══════════════════════════════════════════════');
  console.log('  Remediación de Unidades Huérfanas');
  console.log(`  Modo: ${modoFix ? 'FIX (aplicará cambios)' : 'DRY-RUN (solo reporte)'}`);
  console.log('══════════════════════════════════════════════');
  console.log();

  // 1. Obtener todos los tenantId válidos
  const tenantsValidos = await prisma.tenant.findMany({ select: { tenantId: true } });
  const tenantIdsValidos = new Set(tenantsValidos.map((t) => t.tenantId));
  console.log(`  ℹ️  Tenants válidos en DB: ${tenantIdsValidos.size}`);
  console.log();

  // 2. Buscar unidades sin tenantId o con tenantId inválido
  const todasUnidades = await prisma.unidad.findMany({
    select: { unidadId: true, nombre: true, simbolo: true, tenantId: true },
  });

  const huerfanas: UnidadHuerfana[] = [];
  for (const u of todasUnidades) {
    if (!u.tenantId || !tenantIdsValidos.has(u.tenantId)) {
      const { tenantId, fuente } = await resolverTenantId(u);
      huerfanas.push({
        unidadId: u.unidadId,
        nombre: u.nombre,
        simbolo: u.simbolo,
        tenantIdActual: u.tenantId,
        tenantIdResuelto: tenantId,
        fuente,
      });
    }
  }

  // 3. Reporte
  if (huerfanas.length === 0) {
    console.log('  ✅ No se encontraron unidades huérfanas. Todo OK.');
    return;
  }

  console.log(`  ⚠️  Unidades huérfanas encontradas: ${huerfanas.length}`);
  console.log();

  const resolubles = huerfanas.filter((h) => h.tenantIdResuelto !== null);
  const noResolubles = huerfanas.filter((h) => h.tenantIdResuelto === null);

  for (const h of resolubles) {
    const flecha = h.tenantIdActual ? `${h.tenantIdActual} → ${h.tenantIdResuelto}` : `null → ${h.tenantIdResuelto}`;
    console.log(`  🔧 [${h.fuente.padEnd(11)}] ${h.unidadId} (${h.nombre} / ${h.simbolo})  ${flecha}`);
  }

  for (const h of noResolubles) {
    console.log(`  ❓ [DESCONOCIDA] ${h.unidadId} (${h.nombre} / ${h.simbolo})  tenantId actual: ${h.tenantIdActual ?? 'null'}`);
  }

  console.log();
  console.log(`  Resumen: ${resolubles.length} resolubles, ${noResolubles.length} requieren asignación manual`);

  if (noResolubles.length > 0) {
    console.log();
    console.log('  ⚠️  ATENCIÓN: Las unidades no resolubles no se pueden corregir automáticamente.');
    console.log('     Asignales un tenantId manualmente antes de correr --fix, o eliminalas si son basura.');
  }

  if (!modoFix) {
    console.log();
    console.log('  ℹ️  Modo DRY-RUN: no se aplicaron cambios. Usá --fix para aplicar.');
    return;
  }

  if (resolubles.length === 0) {
    console.log();
    console.log('  ⏭️  Nada que corregir. Saliendo.');
    return;
  }

  // 4. Aplicar fixes en transacción
  console.log();
  console.log('  🚀 Aplicando correcciones...');

  const result = await prisma.$transaction(async (tx) => {
    let corregidas = 0;
    for (const h of resolubles) {
      if (!h.tenantIdResuelto) continue;
      await tx.unidad.update({
        where: { unidadId: h.unidadId },
        data: { tenantId: h.tenantIdResuelto },
      });
      corregidas++;
    }
    return corregidas;
  });

  console.log(`  ✅ ${result} unidades corregidas exitosamente.`);
}

main()
  .catch((err) => {
    console.error('  ❌ Error en remediación:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
