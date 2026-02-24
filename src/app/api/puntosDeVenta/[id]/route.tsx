import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const puntoDeVenta = await prisma.puntoDeVenta.findUnique({
      where: { pvId: id },
    })

    if (!puntoDeVenta) {
      return NextResponse.json({ error: "Punto de venta no encontrado" }, { status: 404 })
    }

    return NextResponse.json(puntoDeVenta)
  } catch (error) {
    console.error("Error al obtener punto de venta:", error)
    return NextResponse.json({ error: "Error al obtener punto de venta" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json()
    const { nombre, ubicacion } = body

    const puntoDeVenta = await prisma.puntoDeVenta.update({
      where: { pvId: id },
      data: {
        nombre,
        ubicacion,
      },
    })

    return NextResponse.json(puntoDeVenta)
  } catch (error) {
    console.error("Error al actualizar punto de venta:", error)
    return NextResponse.json({ error: "Error al actualizar punto de venta" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.puntoDeVenta.delete({
      where: { pvId: id },
    })

    return NextResponse.json({ success: true, id: id })
  } catch (error) {
    console.error("Error al eliminar punto de venta:", error)
    return NextResponse.json({ error: "Error al eliminar punto de venta" }, { status: 500 })
  }
}
