/**
 * @description Backfill opt-in (CTF-5): copia el valor global de
 *              ConfiguracionSistema.diasAvisoVencimientoContrato a una fila de
 *              ConfiguracionContratos por tenant. Idempotente: los tenants que
 *              ya tienen fila se omiten. Ejecución MANUAL post-deploy
 *              (producción corre PRISMA_MIGRATION_MODE=db-push, los backfills
 *              no corren solos):
 *
 *              npx tsx scripts/backfill/configuracion-contratos-tenant.ts
 *
 *              Salida JSON: { tenantsTotales, filasCreadas, yaConfigurados,
 *              valorGlobal }.
 */
import { PrismaClient } from "../../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const global = await prisma.configuracionSistema.findFirst({
    select: { diasAvisoVencimientoContrato: true },
  });
  const valorGlobal = global?.diasAvisoVencimientoContrato ?? 30;

  const tenants = await prisma.tenant.findMany({
    select: { tenantId: true },
  });
  const existentes = await prisma.configuracionContratos.findMany({
    select: { tenantId: true },
  });
  const yaConfigurados = new Set(existentes.map((c) => c.tenantId));

  const pendientes = tenants.filter((t) => !yaConfigurados.has(t.tenantId));

  for (const tenant of pendientes) {
    await prisma.configuracionContratos.create({
      data: { tenantId: tenant.tenantId, diasAvisoVencimiento: valorGlobal },
    });
  }

  console.log(JSON.stringify({
    tenantsTotales: tenants.length,
    filasCreadas: pendientes.length,
    yaConfigurados: yaConfigurados.size,
    valorGlobal,
  }));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(JSON.stringify({ error: e.message }));
  await prisma.$disconnect();
  process.exit(1);
});
