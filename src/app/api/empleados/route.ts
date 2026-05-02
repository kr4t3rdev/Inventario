import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuthGet, withAuthPost, type AuthenticatedUser } from "@/lib/auth-middleware"
import { requireTenant } from "@/lib/services/tenant-scope"

export const GET = withAuthGet(async (_request: NextRequest, _context: any, user: AuthenticatedUser) => {
  try {
    const tenantId = requireTenant(user);
    const empleados = await prisma.empleado.findMany({
      where: { tenantId },
      orderBy: { salarioBases: "desc" },
    })

    return NextResponse.json(empleados)
  } catch (error) {
    console.error("Error al obtener empleados:", error)
    return NextResponse.json({ error: "Error al obtener empleados" }, { status: 500 })
  }
})

export const POST = withAuthPost(async (request: NextRequest, context: any, user: any) => {
  try {
    const data = await request.json()
    const { 
      nombre, 
      apellido, 
      telefono, 
      cargo, 
      salarioBases,
      fechaContratacion,
      esTiempoCompleto = true,
      diasVacacionesAnuales = 15
    } = data

    const empleado = await prisma.empleado.create({
      data: {
        nombre,
        apellido,
        telefono,
        cargo,
        salarioBases,
        fechaContratacion: fechaContratacion ? new Date(fechaContratacion) : new Date(),
        esTiempoCompleto,
        diasVacacionesAnuales
      },
    })
    
    return NextResponse.json(empleado)
  } catch (error) {
    console.error("Error al crear empleado:", error)
    return NextResponse.json({ error: "Error al crear empleado" }, { status: 500 })
  }
})
