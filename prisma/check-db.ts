
import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

async function main() {
  try {
    const miEmpresa = await prisma.miEmpresa.findFirst()
    console.log('MiEmpresa:', miEmpresa)
    
    // Check if we can update it
    if (miEmpresa) {
      const updated = await prisma.miEmpresa.update({
        where: { id: miEmpresa.id },
        data: { propietario: 'Test Propietario' }
      })
      console.log('Updated:', updated)
    }
  } catch (e) {
    console.error(e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
