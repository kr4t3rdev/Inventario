/**
 * @description Backfill script para poblar tenantId en TipoPago existentes.
 *
 * Los TipoPago existentes no tienen tenantId. Este script resuelve el tenant
 * de cada TipoPago a través de sus reconciliaciones asociadas, o asigna
 * al primer tenant disponible como fallback.
 *
 * Uso: npx tsx prisma/seed/backfill-tipos-pago-tenant.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillTiposPagoTenant() {
  console.log('🔍 Buscando TipoPago sin tenantId...');

  const tiposSinTenant = await prisma.tipoPago.findMany({
    where: { tenantId: null },
  });

  console.log(`📦 Encontrados ${tiposSinTenant.length} TipoPago sin tenantId`);

  if (tiposSinTenant.length === 0) {
    console.log('✅ Todos los TipoPago ya tienen tenantId. Nada que hacer.');
    return;
  }

  let asignados = 0;
  let errores = 0;

  for (const tipo of tiposSinTenant) {
    try {
      // Buscar tenantId desde reconciliaciones que referencian este TipoPago
      const reconciliaciones = await Promise.all([
        prisma.reconciliacionVenta.findFirst({
          where: { tipoPagoId: tipo.tipoId },
          select: { tenantId: true },
        }),
        prisma.reconciliacionServicio.findFirst({
          where: { tipoPagoId: tipo.tipoId },
          select: { tenantId: true },
        }),
        prisma.reconciliacionGasto.findFirst({
          where: { tipoPagoId: tipo.tipoId },
          select: { tenantId: true },
        }),
      ]);

      const tenants = reconciliaciones
        .filter((r): r is { tenantId: string } => r !== null)
        .map((r) => r.tenantId);

      let tenantId: string | null = null;

      if (tenants.length > 0) {
        // Usar el tenant más frecuente entre las reconciliaciones
        const freq = tenants.reduce(
          (acc, t) => {
            acc[t] = (acc[t] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );
        tenantId = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
        console.log(`  ✓ TipoPago "${tipo.nombre}" (${tipo.tipoId}) → tenant ${tenantId} (desde reconciliaciones)`);
      } else {
        // Fallback: asignar al primer tenant de la tabla
        const firstTenant = await prisma.tenant.findFirst({
          select: { tenantId: true },
        });
        if (firstTenant) {
          tenantId = firstTenant.tenantId;
          console.log(`  ⚠ TipoPago "${tipo.nombre}" (${tipo.tipoId}) → tenant ${tenantId} (fallback: primer tenant)`);
        } else {
          console.warn(`  ✗ No se pudo resolver tenant para TipoPago "${tipo.nombre}" (${tipo.tipoId}): no hay tenants en la DB`);
          errores++;
          continue;
        }
      }

      await prisma.tipoPago.update({
        where: { tipoId: tipo.tipoId },
        data: { tenantId },
      });
      asignados++;
    } catch (error) {
      console.error(`  ✗ Error procesando TipoPago "${tipo.nombre}" (${tipo.tipoId}):`, error);
      errores++;
    }
  }

  console.log(`\n✅ Backfill completado: ${asignados} asignados, ${errores} errores`);
}

backfillTiposPagoTenant()
  .catch((e) => {
    console.error('Error fatal:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
