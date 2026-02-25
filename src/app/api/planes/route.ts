import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuthPost } from "@/lib/auth-middleware"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10")))
    const skip = (page - 1) * limit

    const [planes, total] = await Promise.all([
      prisma.plan.findMany({
        skip,
        take: limit,
        orderBy: { precio: "asc" },
      }),
      prisma.plan.count(),
    ])

    return NextResponse.json({
      data: planes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
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
