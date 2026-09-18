import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma';
const prisma = new PrismaClient();
const email = `railway-auth-${Date.now()}@test.local`;
const password = 'RailwayPass123!';
async function main() {
  const hash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      name: 'Railway Auth Check',
      email,
      password: hash,
      role: 'admin',
      isActive: true,
      onboardingStatus: null,
      emailVerifiedAt: new Date(),
    },
  });
  console.log(JSON.stringify({ email, password, userId: user.userId }, null, 2));
}
main().catch((e)=>{console.error(e);process.exitCode=1;}).finally(async()=>{await prisma.$disconnect();});
