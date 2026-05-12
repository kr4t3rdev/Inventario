import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuthGet, withAuthPost, type AuthenticatedUser } from "@/lib/auth-middleware"
import { requireTenant } from "@/lib/services/tenant-scope"

export const GET = withAuthGet(async (_request: NextRequest, _context: any, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user);
    const equipos = await prisma.equipoReparacion.findMany({
      where: { tenantId },
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

export const POST = withAuthPost(async (request: NextRequest, _context: any, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user);
    const data = await request.json()

    // Solo permitir crear a usuarios con rol administrativo global.
    if (user.role !== 'admin') {
      return NextResponse.json({
        error: 'Acceso restringido',
        message: 'Los dependientes no pueden crear equipos de reparación'
      }, { status: 403 })
    }

    const nuevoEquipo = await prisma.equipoReparacion.create({
      data: {
        tenantId,
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
