import { PrismaClient } from '../src/generated/prisma';
const prisma = new PrismaClient();
async function main() {
  const email = 'auth-check-1783111635863@test.local';
  const user = await prisma.user.findUnique({ where: { email }, select: { userId: true } });
  if (!user) return console.log(JSON.stringify({ cleaned: false, reason: 'not-found' }));
  await prisma.userSession.deleteMany({ where: { userId: user.userId } });
  await prisma.userActivityLog.deleteMany({ where: { userId: user.userId } });
  await prisma.notification.deleteMany({ where: { userId: user.userId } });
  await prisma.user.delete({ where: { userId: user.userId } });
  console.log(JSON.stringify({ cleaned: true, userId: user.userId }));
}
main().catch((e)=>{console.error(e);process.exitCode=1;}).finally(async()=>{await prisma.$disconnect();});
