import { PrismaClient } from '../src/generated/prisma';

async function main() {
  const prisma = new PrismaClient();
  const tenants = await prisma.tenant.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: { tenantId: true, nombre: true, slug: true },
  });
  console.log(JSON.stringify(tenants, null, 2));
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
