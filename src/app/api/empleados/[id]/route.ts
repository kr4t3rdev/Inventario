import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const empleado = await prisma.empleado.findUnique({
      where: { empleadoId: id },
      include: {        
        ventas: {
          include: {
            producto: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    })

    if (!empleado) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 })
    }

    return NextResponse.json(empleado)
  } catch (error) {
    console.error("Error al obtener empleado:", error)
    return NextResponse.json({ error: "Error al obtener empleado" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { 
      nombre, 
      apellido, 
      telefono, 
      cargo, 
      salarioBases, 
      
    } = await request.json()
    
    const empleado = await prisma.empleado.update({
      where: { empleadoId: id },
      data: {
        nombre, 
        apellido, 
        telefono, 
        cargo, 
        salarioBases, 
        
      },
    })

    return NextResponse.json(empleado)
  } catch (error) {
    console.error("Error al actualizar empleado:", error)
    return NextResponse.json({ error: "Error al actualizar empleado" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context : { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
     await prisma.empleado.delete({
      where: { empleadoId: id },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al eliminar empleado:", error)
    return NextResponse.json({ error: "Error al eliminar empleado" }, { status: 500 })
  }
}
