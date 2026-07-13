import { PrismaClient } from '../src/generated/prisma';

async function main() {
  const prisma = new PrismaClient();
  const users = await prisma.user.findMany({
    where: { role: 'admin' },
    select: {
      userId: true,
      email: true,
      name: true,
      isActive: true,
      expiresAt: true,
      onboardingStatus: true,
    },
  });
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
