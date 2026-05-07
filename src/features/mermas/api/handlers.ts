import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { notificarMerma } from "@/lib/notificaciones-utils"

export async function getMermasHandler() {
  try {
    const mermas = await prisma.merma.findMany({
      include: {
        producto: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })
    return NextResponse.json(mermas)
  } catch (error) {
    console.error("Error al obtener mermas:", error)
    return NextResponse.json({ error: "Error al obtener mermas" }, { status: 500 })
  }
}

export async function createMermaHandler(request: Request) {
  try {
    const body = await request.json()
    const { productoId, cantidad, motivo } = body

    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
    })

    if (!producto) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    }

    if (producto.stock < cantidad) {
      return NextResponse.json({ error: "Stock insuficiente" }, { status: 400 })
    }

    const Total = await prisma.producto.findMany({
      where: {
        id:productoId,
      }
    })
    const costoTotal = Total.reduce((suma: number, t: { precioCosto: number }) => suma + t.precioCosto, 0)

    const [merma] = await prisma.$transaction([
      prisma.merma.create({
        data: {
          producto: { connect: { id: productoId } },
          cantidad,
          motivo,
          costoTotal: costoTotal,
          tenant: { connect: { tenantId: producto.tenantId } }
        },
        include: {
          producto: true,
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
    ])

    try {
      await notificarMerma(merma.mermaId)
    } catch (error) {
      console.error("Error enviando notificación de merma:", error)
    }

    return NextResponse.json(merma, { status: 201 })
  } catch (error) {
    console.error("Error al crear merma:", error)
    return NextResponse.json({ error: "Error al crear merma" }, { status: 500 })
  }
}

export async function getMermaByIdHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

export async function updateMermaHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json()
    const { productoId, cantidad, motivo } = body

    const mermaActual = await prisma.merma.findUnique({
      where: { mermaId: id },
    })

    if (!mermaActual) {
      return NextResponse.json({ error: "Merma no encontrada" }, { status: 404 })
    }

    if (productoId !== mermaActual.productoId || cantidad !== mermaActual.cantidad) {
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

export async function deleteMermaHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const merma = await prisma.merma.findUnique({
      where: { mermaId: id },
    })

    if (!merma) {
      return NextResponse.json({ error: "Merma no encontrada" }, { status: 404 })
    }

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

export async function getMermaStatsHandler() {
  try {
    const totalMermas = await prisma.merma.count()

    const fechaInicio = new Date()
    fechaInicio.setMonth(fechaInicio.getMonth() - 6)

    const mermasPorMes = await prisma.$queryRaw<
      { mes: Date; total: number }[]
    >`
      SELECT 
        DATE_TRUNC('month', "fecha") as mes,
        SUM("cantidad") as total
      FROM "Merma"
      WHERE "fecha" >= ${fechaInicio}
      GROUP BY DATE_TRUNC('month', "fecha")
      ORDER BY mes ASC
    `

    return NextResponse.json({
      totalMermas,
      mermasPorMes: mermasPorMes.map((item: { mes: Date; total: number }) => ({
        mes: new Date(item.mes).toISOString().slice(0, 7),
        total: Number(item.total),
      })),
    })
  } catch (error) {
    console.error("Error al obtener estadísticas de mermas:", error)
    return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 })
  }
}
