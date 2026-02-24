import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"

import { prisma } from "../../../../lib/prisma"


export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    const body = await req.json()

    const { productoId, cantidad, descripcion, origenId, destinoId, puntoDeVentaOrigenId, puntoDeVentaDestinoId } = body

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    if (!productoId || !cantidad) {
      return new NextResponse("Missing required fields", { status: 400 })
    }

    // Verificar que el producto existe
    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
    })

    if (!producto) {
      return new NextResponse("Producto no encontrado", { status: 404 })
    }

    // Verificar que hay suficiente stock
    if (producto.stock < cantidad) {
      return new NextResponse("Stock insuficiente", { status: 400 })
    }

    // Actualizar el stock del producto
    await prisma.producto.update({
      where: { id: productoId },
      data: {
        stock: producto.stock - cantidad,
      },
    })

    // Crear la transferencia
    const transferencia = await prisma.transferencia.create({
      data: {
        productoId,
        cantidad,
        descripcion,
        origenId,
        destinoId,
        puntoDeVentaOrigenId,
        puntoDeVentaDestinoId,
      },
    })

    return NextResponse.json(transferencia)
  } catch (error) {
    console.log("[TRANSFERENCIA_POST]", error)
    return new NextResponse("Internal error", { status: 500 })
  }
}