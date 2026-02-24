import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuthGet, withAuthPost } from "@/lib/auth-middleware"

export const GET = withAuthGet(async (request: NextRequest, context: any, user: any) => {
  try {
    const Servicio = await prisma.servicios.findMany({
      orderBy: { precio: "desc" },
    })

    return NextResponse.json(Servicio)
  } catch (error) {
    console.error("Error al obtener Servicio:", error)
    return NextResponse.json({ error: "Error al obtener Servicio" }, { status: 500 })
  }
})

export const POST = withAuthPost(async (request: NextRequest, context: any, user: any) => {
  try {
    const data = await request.json()

    // Solo permitir crear servicios a usuarios con rol de admin o regularUser
    if (user.role === 'dependiente') {
      return NextResponse.json({
        error: 'Acceso restringido',
        message: 'Los dependientes no pueden crear servicios'
      }, { status: 403 })
    }

    const gastoServicio = await prisma.servicios.create({
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion,
        precio: data.precio,
      },      
    })

    return NextResponse.json(gastoServicio)
  } catch (error) {
    console.error("Error al crear el Servicio:", error)
    return NextResponse.json({ error: "Error al crear el Servicio" }, { status: 500 })
  }
})
