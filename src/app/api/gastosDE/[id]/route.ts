import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const gs = await prisma.gastosDE.findUnique({
      where: { gastosDEId: id },
      
    })

    if (!gs) {
      return NextResponse.json({ error: "Gasto Derivados Empresa no encontrado" }, { status: 404 })
    }

    return NextResponse.json(gs)
  } catch (error) {
    console.error("Error al obtener Gasto Derivados Empresa:", error)
    return NextResponse.json({ error: "Error al obtener Gasto Derivados Empresa" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { createdAt, descripcion, gastosDEId,isPagado,monto, periodo, proveedor,tipo, updatedAt } = await request.json()
    const gs = await prisma.gastosDE.update({
      where: { gastosDEId: id },
      data: {
        createdAt, descripcion, gastosDEId,isPagado,monto, periodo, proveedor,tipo, updatedAt
      },
      
    })

    return NextResponse.json(gs)
  } catch (error) {
    console.error("Error al actualizar el Gasto Derivados Empresa:", error)
    return NextResponse.json({ error: "Error al actualizar el Gasto Derivados Empresa" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context : { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
     await prisma.gastosDE.delete({
      where: { gastosDEId: id },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al eliminar el Gasto Derivados Empresa:", error)
    return NextResponse.json({ error: "Error al eliminar el Gasto Derivados Empresa" }, { status: 500 })
  }
}
