import { type NextRequest, NextResponse } from "next/server"
import { z } from 'zod'
import prisma from "@/lib/prisma"
import { withAuthGet, withAuthPost } from "@/lib/auth-middleware"

const servicioSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().min(1, 'La descripción es requerida'),
  precio: z.coerce.number().int().positive('El precio debe ser mayor a 0'),
})

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
    const body = await request.json()
    const data = servicioSchema.parse(body)

    // Solo permitir crear servicios a usuarios con rol de admin o regularUser
    if (user.role === 'dependiente') {
      return NextResponse.json({
        error: 'Acceso restringido',
        message: 'Los dependientes no pueden crear servicios'
      }, { status: 403 })
    }

    const servicio = await prisma.servicios.create({
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion,
        precio: data.precio,
      },
    })

    return NextResponse.json(servicio)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Datos de entrada inválidos',
        details: error.errors
      }, { status: 400 })
    }

    console.error("Error al crear el Servicio:", error)
    return NextResponse.json({ error: "Error al crear el Servicio" }, { status: 500 })
  }
})
