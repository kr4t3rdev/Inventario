import { PrismaClient } from '../src/generated/prisma';
async function main() {
  const prisma = new PrismaClient();
  const logs = await prisma.backupLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { backupLogId: true, type: true, tenantId: true, status: true, errorMessage: true, createdAt: true, completedAt: true, fileUrl: true },
  });
  console.log(JSON.stringify(logs, null, 2));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
