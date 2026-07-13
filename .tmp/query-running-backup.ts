import { PrismaClient } from '../src/generated/prisma';
async function main() {
  const prisma = new PrismaClient();
  const log = await prisma.backupLog.findUnique({
    where: { backupLogId: 'cmr8t9cds001x14h2o35emss6' },
    select: { backupLogId: true, type: true, status: true, errorMessage: true, startedAt: true, createdAt: true, completedAt: true, fileUrl: true, fileName: true, fileSize: true },
  });
  console.log(JSON.stringify(log, null, 2));
  await prisma.$disconnect();
}
main().catch((e)=>{console.error(e); process.exit(1)})
