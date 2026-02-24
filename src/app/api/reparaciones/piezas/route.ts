import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuthPost } from "@/lib/auth-middleware"

export const POST = withAuthPost(async (request: NextRequest, context: any, user: any) => {
  try {
    const data = await request.json()

    if (user.role === 'dependiente') {
      return NextResponse.json({
        error: 'Acceso restringido',
        message: 'Los dependientes no pueden crear piezas'
      }, { status: 403 })
    }

    const nuevaPieza = await prisma.piezaReparacion.create({
      data: {
        nombre: data.nombre,
        equipoId: data.equipoId,
        costoPequeno: data.costoPequeno,
        costoMediano: data.costoMediano,
        costoGrande: data.costoGrande,
      },
    })

    return NextResponse.json(nuevaPieza)
  } catch (error) {
    console.error("Error al crear pieza de reparación:", error)
    return NextResponse.json({ error: "Error al crear pieza de reparación" }, { status: 500 })
  }
})
