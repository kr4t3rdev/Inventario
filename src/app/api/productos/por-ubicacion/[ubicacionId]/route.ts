import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest, { params }: { params: Promise<{ ubicacionId: string }> }) {
  try {
    const ubicacionId = (await params).ubicacionId

    // Verificar si la ubicación existe y determinar el tipo
    let isPuntoVenta = false
    const puntoVenta = await prisma.puntoDeVenta.findUnique({
      where: { pvId: ubicacionId },
    })
    if (puntoVenta) {
      isPuntoVenta = true
    } else {
      const almacen = await prisma.almacen.findUnique({
        where: { almacenId: ubicacionId },
      })
      if (!almacen) {
        return NextResponse.json({ error: "Ubicación no encontrada" }, { status: 404 })
      }
    }

    // Obtener todos los productos con sus fotos
    const productos = await prisma.producto.findMany({
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        precioCosto: true,
        precioVenta: true,
        stock: true,
        fotos: true,
        categoriaId: true,
        unidadId: true,
        vendorId: true,
        createdAt: true,
        updatedAt: true,
        categoria: true,
        unidad: true,
        vendor: true,
      },
    })

    // Para cada producto, calcular su stock en la ubicación específica
    const productosConStock = await Promise.all(
      productos.map(async (producto) => {
        let stockEnUbicacion = 0

        if (isPuntoVenta) {
          // Calcular stock en punto de venta

          // 1. Transferencias recibidas (entrada)
          const transferenciasEntrada = await prisma.transferencia.aggregate({
            where: {
              productoId: producto.id,
              puntoDeVentaDestinoId: ubicacionId,
            },
            _sum: {
              cantidad: true,
            },
          })

          // 2. Transferencias enviadas (salida)
          const transferenciasSalida = await prisma.transferencia.aggregate({
            where: {
              productoId: producto.id,
              puntoDeVentaOrigenId: ubicacionId,
            },
            _sum: {
              cantidad: true,
            },
          })

          // 3. Ventas realizadas (salida)
          const [ventasItems, ventasLegacy] = await Promise.all([
            prisma.ventaItem.aggregate({
              where: {
                productoId: producto.id,
                venta: {
                  puntoDeVentaId: ubicacionId,
                },
              },
              _sum: {
                cantidad: true,
              },
            }),
            prisma.venta.aggregate({
              where: {
                productoId: producto.id,
                puntoDeVentaId: ubicacionId,
                items: { none: {} },
              },
              _sum: {
                cantidad: true,
              },
            }),
          ])

          // Calcular stock: entradas - salidas - ventas
          stockEnUbicacion =
            (transferenciasEntrada._sum.cantidad || 0) -
            (transferenciasSalida._sum.cantidad || 0) -
            ((ventasItems._sum.cantidad || 0) + (ventasLegacy._sum.cantidad || 0))
        } else {
          // Calcular stock en almacén (base + transferencias entre almacenes)
          const stockBase = producto.stock

          // 1. Transferencias recibidas (entrada) desde almacenes
          const transferenciasEntrada = await prisma.transferencia.aggregate({
            where: {
              productoId: producto.id,
              destinoId: ubicacionId,
              puntoDeVentaOrigenId: null,
            },
            _sum: {
              cantidad: true,
            },
          })

          // 2. Transferencias enviadas (salida) hacia almacenes
          const transferenciasSalida = await prisma.transferencia.aggregate({
            where: {
              productoId: producto.id,
              origenId: ubicacionId,
              puntoDeVentaDestinoId: null,
            },
            _sum: {
              cantidad: true,
            },
          })

          // Calcular stock: base + entradas - salidas
          stockEnUbicacion =
            stockBase +
            (transferenciasEntrada._sum.cantidad || 0) -
            (transferenciasSalida._sum.cantidad || 0)
        }

        // // Si no hay movimientos registrados, asignar una parte proporcional del stock total
        // // Esto es para manejar el stock inicial que no tiene movimientos registrados
        // if (stockEnUbicacion === 0) {
        //   // Contar cuántas ubicaciones hay en total (almacenes + puntos de venta)
        //   const countAlmacenes = await prisma.almacen.count()
        //   const countPuntosVenta = await prisma.puntoDeVenta.count()
        //   const totalUbicaciones = countAlmacenes + countPuntosVenta

        //   // if (totalUbicaciones > 0) {
        //   //   // Distribuir el stock proporcionalmente
        //   //   stockEnUbicacion = Math.floor(producto.stock / totalUbicaciones)
        //   // }
        // }

        // Asegurarse de que el stock no sea negativo
        stockEnUbicacion = Math.max(0, stockEnUbicacion)

        return {
          ...producto,
          stockEnUbicacion,
        }
      }),
    )

    // Filtrar productos que tienen stock en la ubicación
    const productosDisponibles = productosConStock.filter((p) => p.stockEnUbicacion > 0)

    return NextResponse.json(productosDisponibles)
  } catch (error) {
    console.error("Error al obtener productos por ubicación:", error)
    return NextResponse.json({ error: "Error al obtener productos por ubicación" }, { status: 500 })
  }
}
