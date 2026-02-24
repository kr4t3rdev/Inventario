import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuthPost } from "@/lib/auth-middleware"

export async function GET() {
  try {
    const planes = await prisma.plan.findMany({
      orderBy: { precio: "asc" },
    })
    return NextResponse.json(planes)
  } catch (error) {
    console.error("Error fetching planes:", error)
    return NextResponse.json({ error: "Error fetching planes" }, { status: 500 })
  }
}

export const POST = withAuthPost(async (request: NextRequest, _context: unknown, user: any) => {
  if (user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const body = await request.json()
  const { nombre, descripcion, precio, duracionDias, maxUsuarios, maxAlmacenes, maxProductos } = body

  if (!nombre || !duracionDias) {
    return NextResponse.json(
      { error: "Nombre y duración son requeridos" },
      { status: 400 }
    )
  }

  const plan = await prisma.plan.create({
    data: {
      nombre,
      descripcion,
      precio: precio || 0,
      duracionDias,
      maxUsuarios: maxUsuarios || 1,
      maxAlmacenes: maxAlmacenes || 1,
      maxProductos: maxProductos || 100,
    },
  })

  return NextResponse.json(plan, { status: 201 })
})
