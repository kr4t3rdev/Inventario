import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth } from "@/lib/auth-middleware"

// PUT: Actualizar equipo
const updateEquipo = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user: any
) => {
  try {
    const { id } = await params
    const data = await request.json()

    if (user.role === 'dependiente') {
      return NextResponse.json({
        error: 'Acceso restringido',
        message: 'Los dependientes no pueden editar equipos'
      }, { status: 403 })
    }

    const updatedEquipo = await prisma.equipoReparacion.update({
      where: { id },
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion,
      },
    })

    return NextResponse.json(updatedEquipo)
  } catch (error) {
    console.error("Error al actualizar equipo:", error)
    return NextResponse.json({ error: "Error al actualizar equipo" }, { status: 500 })
  }
}

// DELETE: Eliminar equipo
const deleteEquipo = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  user: any
) => {
  try {
    const { id } = await params

    if (user.role === 'dependiente') {
      return NextResponse.json({
        error: 'Acceso restringido',
        message: 'Los dependientes no pueden eliminar equipos'
      }, { status: 403 })
    }

    await prisma.equipoReparacion.delete({
      where: { id },
    })

    return NextResponse.json({ message: "Equipo eliminado correctamente" })
  } catch (error) {
    console.error("Error al eliminar equipo:", error)
    return NextResponse.json({ error: "Error al eliminar equipo" }, { status: 500 })
  }
}

export const PUT = withAuth(updateEquipo)
export const DELETE = withAuth(deleteEquipo)
