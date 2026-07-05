import bcrypt from 'bcryptjs';
import { PrismaClient } from '../../../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || `railway-auth-${Date.now()}@test.local`;
  const password = process.env.ADMIN_PASSWORD || 'RailwayPass123!';
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
