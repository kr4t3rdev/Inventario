import { PrismaClient } from '../src/generated/prisma';
const prisma = new PrismaClient();
const email = 'railway-auth-1783183016399@test.local';

async function main() {
  const deleted = await prisma.user.deleteMany({ where: { email } });
  console.log(JSON.stringify({ email, deleted: deleted.count }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
