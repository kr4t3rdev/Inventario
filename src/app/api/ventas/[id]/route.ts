import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const venta = await prisma.venta.findUnique({
      where: { ventaId: id },
      include: {
        producto: true,
        puntoDeVenta: true,
        items: {
          include: {
            producto: {
              select: {
                id: true,
                nombre: true,
                precioVenta: true,
                unidad: { select: { simbolo: true } },
              },
            },
          },
        },
      },
    })

    if (!venta) {
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })
    }

    return NextResponse.json(venta)
  } catch (error) {
    console.error("Error al obtener venta:", error)
    return NextResponse.json({ error: "Error al obtener venta" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json()
    const { productoId, cantidad, fecha, puntoDeVentaId } = body

    // Obtener la venta actual para calcular la diferencia de stock
    const ventaActual = await prisma.venta.findUnique({
      where: { ventaId: id },
      include: {
        items: true,
      },
    })

    if (!ventaActual) {
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })
    }

    if (ventaActual.items && ventaActual.items.length > 1) {
      return NextResponse.json(
        { error: "No se puede actualizar una venta con múltiples productos desde esta ruta" },
        { status: 400 }
      )
    }

    const itemActual = ventaActual.items?.[0]
    const productoActualId = ventaActual.productoId || itemActual?.productoId || null
    const cantidadActual = ventaActual.productoId
      ? ventaActual.cantidad
      : (itemActual?.cantidad ?? ventaActual.cantidad)

    // Si cambia el producto o la cantidad, actualizar el stock
    if (productoId !== productoActualId || cantidad !== cantidadActual) {
      // Verificar stock disponible si es un nuevo producto o aumenta la cantidad
      if (productoId !== productoActualId || cantidad > cantidadActual) {
        const productoIdVerificar = productoId || productoActualId
        if (!productoIdVerificar) {
          return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
        }

        const producto = await prisma.producto.findUnique({
          where: { id: productoIdVerificar },
        })

        if (!producto) {
          return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
        }

        const cantidadAdicional = productoId !== productoActualId ? cantidad : cantidad - cantidadActual

        if (producto.stock < cantidadAdicional) {
          return NextResponse.json({ error: "Stock insuficiente" }, { status: 400 })
        }
      }

      const productoIdFinal = productoId || productoActualId

      const productoPrecio = productoIdFinal
        ? await prisma.producto.findUnique({
            where: { id: productoIdFinal },
            select: { precioVenta: true },
          })
        : null

      const itemPayload = productoIdFinal && productoPrecio
        ? {
            productoId: productoIdFinal,
            cantidad,
            precioUnitario: Number(productoPrecio.precioVenta),
            total: Number(productoPrecio.precioVenta) * Number(cantidad),
          }
        : null

      // Actualizar venta y stock en una transacción
      const stockUpdates = []
      if (productoIdFinal && productoActualId && productoIdFinal !== productoActualId) {
        stockUpdates.push(
          prisma.producto.update({
            where: { id: productoActualId },
            data: {
              stock: {
                increment: cantidadActual,
              },
            },
          }),
        )
        stockUpdates.push(
          prisma.producto.update({
            where: { id: productoIdFinal },
            data: {
              stock: {
                decrement: cantidad,
              },
            },
          }),
        )
      } else if (productoIdFinal) {
        stockUpdates.push(
          prisma.producto.update({
            where: { id: productoIdFinal },
            data: {
              stock: {
                increment: cantidadActual - cantidad,
              },
            },
          }),
        )
      }

      const [venta] = await prisma.$transaction([
        prisma.venta.update({
          where: { ventaId: id },
          data: {
            productoId: ventaActual.productoId ? productoId : undefined,
            cantidad,
            createdAt: fecha ? new Date(fecha) : undefined,
            puntoDeVentaId,
          },
          include: {
            producto: true,
            puntoDeVenta: true,
            items: {
              include: {
                producto: {
                  select: {
                    id: true,
                    nombre: true,
                    precioVenta: true,
                    unidad: { select: { simbolo: true } },
                  },
                },
              },
            },
          },
        }),
        ...(itemPayload
          ? [
              ventaActual.items?.[0]?.id
                ? prisma.ventaItem.update({
                    where: { id: ventaActual.items[0].id },
                    data: itemPayload,
                  })
                : prisma.ventaItem.create({
                    data: {
                      ventaId: id,
                      ...itemPayload,
                    },
                  }),
            ]
          : []),
        ...stockUpdates,
      ])

      return NextResponse.json(venta)
    } else {
      // Si solo cambia la fecha o el punto de venta, no afecta al stock
      const venta = await prisma.venta.update({
        where: { ventaId: id },
        data: {
          createdAt: fecha ? new Date(fecha) : undefined,
          puntoDeVentaId,
        },
        include: {
          producto: true,
          puntoDeVenta: true,
        },
      })

      return NextResponse.json(venta)
    }
  } catch (error) {
    console.error("Error al actualizar venta:", error)
    return NextResponse.json({ error: "Error al actualizar venta" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Obtener la venta para restaurar el stock
    const venta = await prisma.venta.findUnique({
      where: { ventaId: id },
      include: {
        items: true,
      },
    })

    if (!venta) {
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 })
    }

    if (venta.items && venta.items.length > 0) {
      await prisma.venta.delete({
        where: { ventaId: id },
      })
      return NextResponse.json({ success: true, id: id })
    }

    // Eliminar venta y restaurar stock en una transacción (solo ventas individuales legacy)
    await prisma.$transaction([
      prisma.venta.delete({
        where: { ventaId: id },
      }),
      prisma.producto.update({
        where: { id: venta.productoId! },
        data: {
          stock: {
            increment: venta.cantidad,
          },
        },
      }),
    ])

    return NextResponse.json({ success: true, id: id })
  } catch (error) {
    console.error("Error al eliminar venta:", error)
    return NextResponse.json({ error: "Error al eliminar venta" }, { status: 500 })
  }
}
