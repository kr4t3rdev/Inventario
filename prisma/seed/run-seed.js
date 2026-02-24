import { PrismaClient } from '../../src/generated/prisma/index.js'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function runSeed() {
  console.log('🌱 Ejecutando seed de datos históricos...')

  try {
    // Leer el archivo SQL
    const sqlFilePath = path.join(__dirname, 'historical-data.sql')
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8')

    // Ejecutar el SQL usando Prisma
    await prisma.$executeRawUnsafe(sqlContent)

    console.log('✅ Datos históricos insertados exitosamente')

    // Verificar que los datos se insertaron
    const categoriaCount = await prisma.categoria.count({
      where: {
        catId: {
          contains: 'hist'
        }
      }
    })

    const productoCount = await prisma.producto.count({
      where: {
        id: {
          contains: 'hist'
        }
      }
    })

    const ventaCount = await prisma.venta.count({
      where: {
        ventaId: {
          contains: 'hist'
        }
      }
    })

    console.log(`📊 Verificación de datos insertados:`)
    console.log(`   Categorías históricas: ${categoriaCount}`)
    console.log(`   Productos históricos: ${productoCount}`)
    console.log(`   Ventas históricas: ${ventaCount}`)

  } catch (error) {
    console.error('❌ Error ejecutando el seed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSeed()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}