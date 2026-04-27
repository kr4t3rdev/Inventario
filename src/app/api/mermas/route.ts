import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { notificarMerma } from "../../../lib/notificaciones-utils"
import { authenticateUser } from "@/lib/auth-middleware"
import { assertOperationAllowed, isPeriodoOperacionError, serializePeriodoOperacionError } from "@/lib/services/periodo-operacion-guard"
import { registrarEventoContable } from "@/lib/services/evento-contable-integration"

export async function GET() {
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

export async function POST(request: Request) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const body = await request.json()
    const { productoId, cantidad, motivo } = body

    await assertOperationAllowed(new Date(), 'MERMA')

    // Verificar stock disponible
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
    // Crear merma y actualizar stock en una transacción
    const [merma] = await prisma.$transaction([
      prisma.merma.create({
        data: {
          productoId,
          cantidad,
          motivo,
          costoTotal: costoTotal
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

    await registrarEventoContable({
      origenTipo: 'MERMA',
      origenId: merma.mermaId,
      monto: costoTotal,
      fechaOperacion: new Date(),
      descripcion: `Merma de producto ${productoId}: ${motivo || 'sin motivo'}`,
      usuarioId: (user as Record<string, unknown>).userId as string || 'system',
    })

    return NextResponse.json(merma, { status: 201 })
  } catch (error) {
    if (isPeriodoOperacionError(error)) {
      return NextResponse.json(serializePeriodoOperacionError(error), { status: error.status })
    }
    console.error("Error al crear merma:", error)
    return NextResponse.json({ error: "Error al crear merma" }, { status: 500 })
  }
}
