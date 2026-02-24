import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth } from "@/lib/auth-middleware"

// PUT: Actualizar pieza
const updatePieza = async (request: NextRequest, { params }: { params: { id: string } }, user: any) => {
  try {
    const data = await request.json()

    if (user.role === 'dependiente') {
      return NextResponse.json({
        error: 'Acceso restringido',
        message: 'Los dependientes no pueden editar piezas'
      }, { status: 403 })
    }

    const updatedPieza = await prisma.piezaReparacion.update({
      where: { id: params.id },
      data: {
        nombre: data.nombre,
        costoPequeno: data.costoPequeno,
        costoMediano: data.costoMediano,
        costoGrande: data.costoGrande,
      },
    })

    return NextResponse.json(updatedPieza)
  } catch (error) {
    console.error("Error al actualizar pieza:", error)
    return NextResponse.json({ error: "Error al actualizar pieza" }, { status: 500 })
  }
}

// DELETE: Eliminar pieza
const deletePieza = async (request: NextRequest, { params }: { params: { id: string } }, user: any) => {
  try {
    if (user.role === 'dependiente') {
      return NextResponse.json({
        error: 'Acceso restringido',
        message: 'Los dependientes no pueden eliminar piezas'
      }, { status: 403 })
    }

    await prisma.piezaReparacion.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: "Pieza eliminada correctamente" })
  } catch (error) {
    console.error("Error al eliminar pieza:", error)
    return NextResponse.json({ error: "Error al eliminar pieza" }, { status: 500 })
  }
}

export const PUT = withAuth(updatePieza)
export const DELETE = withAuth(deletePieza)
