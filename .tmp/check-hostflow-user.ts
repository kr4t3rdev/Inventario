import { PrismaClient } from '../src/generated/prisma';
const prisma = new PrismaClient();
async function main() {
  const email = 'bad-hostflow-1783160878685';
  const user = await prisma.user.findUnique({ where: { email }, select: { userId: true, email: true, onboardingStatus: true, pendingReferralCode: true, emailVerifiedAt: true, isActive: true } });
  console.log(JSON.stringify(user, null, 2));
}
main().catch((e)=>{console.error(e);process.exitCode=1;}).finally(async()=>{await prisma.$disconnect();});
