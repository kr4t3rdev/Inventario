import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: Request,{ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const unidad = await prisma.unidad.findUnique({
      where: { unidadId: id },
      select: {
        unidadId: true,
        nombre: true,
        simbolo: true,
        createdAt: true,
        updatedAt: true,
      },
    })     

    if (!unidad) {
      return NextResponse.json({ error: "Unidad no encontrada" }, { status: 404 })
    }

    return NextResponse.json(unidad)
  } catch (error) {
    console.error("Error al obtener unidad:", error)
    return NextResponse.json({ error: "Error al obtener unidad" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json()
    const { nombre, simbolo } = body

    const unidad = await prisma.unidad.update({
      where: { unidadId: id },
      data: {
        nombre,
        simbolo,
      },
    })

    return NextResponse.json(unidad)
  } catch (error) {
    console.error("Error al actualizar unidad:", error)
    return NextResponse.json({ error: "Error al actualizar unidad" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.unidad.delete({
      where: { unidadId: id },
    })

    return NextResponse.json({ success: true, id: id })
  } catch (error) {
    console.error("Error al eliminar unidad:", error)
    return NextResponse.json({ error: "Error al eliminar unidad" }, { status: 500 })
  }
}
