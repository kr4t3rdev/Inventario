import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const merma = await prisma.merma.findUnique({
      where: { mermaId: id },
      include: {
        producto: true,
      },
    })

    if (!merma) {
      return NextResponse.json({ error: "Merma no encontrada" }, { status: 404 })
    }

    return NextResponse.json(merma)
  } catch (error) {
    console.error("Error al obtener merma:", error)
    return NextResponse.json({ error: "Error al obtener merma" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json()
    const { productoId, cantidad, motivo } = body

    // Obtener la merma actual para calcular la diferencia de stock
    const mermaActual = await prisma.merma.findUnique({
      where: { mermaId: id },
    })

    if (!mermaActual) {
      return NextResponse.json({ error: "Merma no encontrada" }, { status: 404 })
    }

    // Si cambia el producto o la cantidad, actualizar el stock
    if (productoId !== mermaActual.productoId || cantidad !== mermaActual.cantidad) {
      // Verificar stock disponible si es un nuevo producto o aumenta la cantidad
      if (productoId !== mermaActual.productoId || cantidad > mermaActual.cantidad) {
        const producto = await prisma.producto.findUnique({
          where: { id: productoId || mermaActual.productoId },
        })

        if (!producto) {
          return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
        }

        const cantidadAdicional = productoId !== mermaActual.productoId ? cantidad : cantidad - mermaActual.cantidad

        if (producto.stock < cantidadAdicional) {
          return NextResponse.json({ error: "Stock insuficiente" }, { status: 400 })
        }
      }

      // Actualizar merma y stock en una transacción
      const [merma] = await prisma.$transaction([
        prisma.merma.update({
          where: { mermaId: id },
          data: {
            productoId,
            cantidad,
            motivo,
          },
          include: {
            producto: true,
          },
        }),
        // Si cambia el producto, restaurar el stock del producto anterior
        ...(productoId !== mermaActual.productoId
          ? [
              prisma.producto.update({
                where: { id: mermaActual.productoId },
                data: {
                  stock: {
                    increment: mermaActual.cantidad,
                  },
                },
              }),
              prisma.producto.update({
                where: { id: productoId },
                data: {
                  stock: {
                    decrement: cantidad,
                  },
                },
              }),
            ]
          : [
              prisma.producto.update({
                where: { id: mermaActual.productoId },
                data: {
                  stock: {
                    increment: mermaActual.cantidad - cantidad,
                  },
                },
              }),
            ]),
      ])

      return NextResponse.json(merma)
    } else {
      // Si solo cambia la fecha o el motivo, no afecta al stock
      const merma = await prisma.merma.update({
        where: { mermaId: id },
        data: {
          motivo,
        },
        include: {
          producto: true,
        },
      })

      return NextResponse.json(merma)
    }
  } catch (error) {
    console.error("Error al actualizar merma:", error)
    return NextResponse.json({ error: "Error al actualizar merma" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Obtener la merma para restaurar el stock
    const merma = await prisma.merma.findUnique({
      where: { mermaId: id },
    })

    if (!merma) {
      return NextResponse.json({ error: "Merma no encontrada" }, { status: 404 })
    }

    // Eliminar merma y restaurar stock en una transacción
    await prisma.$transaction([
      prisma.merma.delete({
        where: { mermaId: id },
      }),
      prisma.producto.update({
        where: { id: merma.productoId },
        data: {
          stock: {
            increment: merma.cantidad,
          },
        },
      }),
    ])

    return NextResponse.json({ success: true, id: id })
  } catch (error) {
    console.error("Error al eliminar merma:", error)
    return NextResponse.json({ error: "Error al eliminar merma" }, { status: 500 })
  }
}
