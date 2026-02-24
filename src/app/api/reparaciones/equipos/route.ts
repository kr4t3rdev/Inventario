import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuthGet, withAuthPost } from "@/lib/auth-middleware"

export const GET = withAuthGet(async (request: NextRequest, context: any, user: any) => {
  try {
    const equipos = await prisma.equipoReparacion.findMany({
      include: {
        piezas: true,
      },
      orderBy: { nombre: "asc" },
    })

    return NextResponse.json(equipos)
  } catch (error) {
    console.error("Error al obtener equipos de reparación:", error)
    return NextResponse.json({ error: "Error al obtener equipos de reparación" }, { status: 500 })
  }
})

export const POST = withAuthPost(async (request: NextRequest, context: any, user: any) => {
  try {
    const data = await request.json()

    // Solo permitir crear a usuarios con rol de admin o regularUser (no dependientes)
    if (user.role === 'dependiente') {
      return NextResponse.json({
        error: 'Acceso restringido',
        message: 'Los dependientes no pueden crear equipos de reparación'
      }, { status: 403 })
    }

    const nuevoEquipo = await prisma.equipoReparacion.create({
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion,
      },
    })

    return NextResponse.json(nuevoEquipo)
  } catch (error) {
    console.error("Error al crear el equipo de reparación:", error)
    return NextResponse.json({ error: "Error al crear el equipo de reparación" }, { status: 500 })
  }
})
