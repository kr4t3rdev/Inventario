import { PrismaClient } from '../src/generated/prisma'
const prisma = new PrismaClient()

async function main() {
  const tenant = await prisma.tenant.findFirst()
  if (tenant) {
    console.log(tenant.tenantId)
  } else {
    console.log('NO_TENANT_FOUND')
  }
  await prisma.$disconnect()
}

main()
