import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const servicios = await prisma.servicios.findUnique({
      where: { servicioId: id },
      
    })

    if (!servicios) {
      return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 })
    }

    return NextResponse.json(servicios)
  } catch (error) {
    console.error("Error al obtener Servicio:", error)
    return NextResponse.json({ error: "Error al obtener Servicio" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { createdAt, nombre, servicioId,precio, descripcion, updatedAt } = await request.json()
    const servicios = await prisma.servicios.update({
      where: { servicioId: id },
      data: {
        createdAt, nombre,precio, servicioId, descripcion, updatedAt
      },
      
    })

    return NextResponse.json(servicios)
  } catch (error) {
    console.error("Error al actualizar el Servicio:", error)
    return NextResponse.json({ error: "Error al actualizar el Servicio" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context : { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
     await prisma.servicios.delete({
      where: { servicioId: id },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al eliminar el Servicio:", error)
    return NextResponse.json({ error: "Error al eliminar el Servicio" }, { status: 500 })
  }
}
