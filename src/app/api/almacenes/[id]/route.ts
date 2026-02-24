import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const almacen = await prisma.almacen.findUnique({
      where: { almacenId: id },
      include: { productos: true },
    })

    if (!almacen) {
      return NextResponse.json({ error: "Almacen no encontrado" }, { status: 404 })
    }

    return NextResponse.json(almacen)
  } catch (error) {
    console.error("Error al obtener almacen:", error)
    return NextResponse.json({ error: "Error al obtener almacen" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { nombre } = body

    const almacen = await prisma.almacen.update({
      where: { almacenId: id },
      data: {
        nombre,
        
      },
    })

    return NextResponse.json(almacen)
  } catch (error) {
    console.error("Error al actualizar almacen:", error)
    return NextResponse.json({ error: "Error al actualizar almacen" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.almacen.delete({
      where: { almacenId: id },
    })

    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error("Error al eliminar almacen:", error)
    return NextResponse.json({ error: "Error al eliminar almacen" }, { status: 500 })
  }
}
