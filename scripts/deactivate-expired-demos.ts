/**
 * @description Desactiva licencias demo expiradas.
 *              Ejecutar con: npx tsx scripts/deactivate-expired-demos.ts
 */
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();

  const expired = await prisma.tenantLicense.findMany({
    where: {
      isDemo: true,
      activa: true,
      expiracion: { lt: now },
    },
    select: { tenantLicenseId: true, tenantId: true, expiracion: true },
  });

  if (expired.length === 0) {
    console.log(JSON.stringify({ deactivated: 0, message: "No hay demos expiradas" }));
    await prisma.$disconnect();
    return;
  }

  await prisma.tenantLicense.updateMany({
    where: {
      tenantLicenseId: { in: expired.map((l) => l.tenantLicenseId) },
    },
    data: { activa: false },
  });

  console.log(JSON.stringify({
    deactivated: expired.length,
    licenses: expired.map((l) => ({
      id: l.tenantLicenseId,
      tenantId: l.tenantId,
      expiredAt: l.expiracion.toISOString(),
    })),
  }));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(JSON.stringify({ error: e.message }));
  await prisma.$disconnect();
  process.exit(1);
});
