import { PrismaClient } from '../src/generated/prisma';
async function main() {
  const prisma = new PrismaClient();
  const id = process.argv[2]!;
  const log = await prisma.backupLog.findUnique({ where: { backupLogId: id }, select: { backupLogId:true,type:true,status:true,errorMessage:true,createdAt:true,completedAt:true,fileUrl:true,fileName:true,fileSize:true } });
  console.log(JSON.stringify(log, null, 2));
  await prisma.$disconnect();
}
main().catch((e)=>{console.error(e); process.exit(1)})
