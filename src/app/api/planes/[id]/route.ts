import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuthGet, withAuthPost } from "@/lib/auth-middleware"

export const GET = withAuthGet(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const plan = await prisma.plan.findUnique({
      where: { planId: id },
    })

    if (!plan) {
      return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 })
    }

    return NextResponse.json(plan)
  }
)

export const PUT = withAuthPost(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }, user: any) => {
    if (user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { nombre, descripcion, precio, duracionDias, maxUsuarios, maxAlmacenes, maxProductos } = body

    const plan = await prisma.plan.update({
      where: { planId: id },
      data: {
        nombre,
        descripcion,
        precio: precio || 0,
        duracionDias,
        maxUsuarios,
        maxAlmacenes,
        maxProductos,
      },
    })

    return NextResponse.json(plan)
  }
)

export const DELETE = withAuthPost(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }, user: any) => {
    if (user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const { id } = await params

    const licenciasCount = await prisma.licencia.count({
      where: { planId: id },
    })

    if (licenciasCount > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar un plan con licencias asociadas" },
        { status: 400 }
      )
    }

    await prisma.plan.delete({ where: { planId: id } })

    return NextResponse.json({ message: "Plan eliminado" })
  }
)
