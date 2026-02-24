import prisma from './prisma'

async function verificarStockBajo() {
  try {
    console.log("Verificando stock bajo...")

    // Obtener productos con stock bajo
    const productosStockBajo = await prisma.producto.findMany({
      where: {
        stock: {
          lte: 10,
          gt: 0,
        },
      },
      include: {
        categoria: true,
        almacen: true,
      },
    })

    // Obtener productos sin stock
    const productosSinStock = await prisma.producto.findMany({
      where: {
        stock: 0,
      },
      include: {
        categoria: true,
        almacen: true,
      },
    })

    // Obtener todos los usuarios activos
    const usuarios = await prisma.user.findMany({
      where: { isActive: true },
      select: { userId: true },
    })

    // Crear notificaciones para stock bajo
    for (const producto of productosStockBajo) {
      // Verificar si ya existe una notificación reciente
      const notificacionExistente = await prisma.notification.findFirst({
        where: {
          type: "stock_bajo",
          message: {
            contains: producto.nombre,
          },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Últimas 24 horas
          },
        },
      })

      if (!notificacionExistente) {
        // Crear notificación para todos los usuarios
        for (const usuario of usuarios) {
          await prisma.notification.create({
            data: {
              title: "Stock Bajo",
              message: `El producto "${producto.nombre}" tiene stock bajo (${producto.stock} unidades restantes)`,
              type: "stock_bajo",
              prioridad: "media",
              userId: usuario.userId,
            },
          })
        }
        console.log(`Notificación creada para stock bajo: ${producto.nombre}`)
      }
    }

    // Crear notificaciones para productos sin stock
    for (const producto of productosSinStock) {
      const notificacionExistente = await prisma.notification.findFirst({
        where: {
          type: "sin_stock",
          message: {
            contains: producto.nombre,
          },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      })

      if (!notificacionExistente) {
        for (const usuario of usuarios) {
          await prisma.notification.create({
            data: {
              title: "Sin Stock",
              message: `El producto "${producto.nombre}" está agotado`,
              type: "sin_stock",
              prioridad: "alta",
              userId: usuario.userId,
            },
          })
        }
        console.log(`Notificación creada para sin stock: ${producto.nombre}`)
      }
    }

    console.log(
      `Verificación completada. ${productosStockBajo.length} productos con stock bajo, ${productosSinStock.length} productos sin stock`,
    )
  } catch (error) {
    console.error("Error verificando stock:", error)
  } finally {
    await prisma.$disconnect()
  }
}

verificarStockBajo()
