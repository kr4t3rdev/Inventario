import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuthPost } from "@/lib/auth-middleware"

export async function GET() {
  try {
    const licencias = await prisma.licencia.findMany({
      include: {
        usuario: { select: { userId: true, name: true, email: true } },
        plan: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(licencias)
  } catch (error) {
    console.error("Error fetching licencias:", error)
    return NextResponse.json({ error: "Error fetching licencias" }, { status: 500 })
  }
}

export const POST = withAuthPost(async (request: NextRequest, _context: unknown, user: any) => {
  if (user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const body = await request.json()
  const { clave, usuarioId, planId, duracionDias } = body

  if (!clave || !usuarioId || !planId) {
    return NextResponse.json(
      { error: "Clave, usuario y plan son requeridos" },
      { status: 400 }
    )
  }

  const plan = await prisma.plan.findUnique({ where: { planId } })
  if (!plan) {
    return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 })
  }

  const usuario = await prisma.user.findUnique({ where: { userId: usuarioId } })
  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  }

  const expiracion = new Date()
  expiracion.setDate(expiracion.getDate() + (duracionDias || plan.duracionDias))

  const licencia = await prisma.licencia.create({
    data: {
      clave,
      usuarioId,
      planId,
      expiracion,
    },
    include: {
      usuario: { select: { userId: true, name: true, email: true } },
      plan: true,
    },
  })

  return NextResponse.json(licencia, { status: 201 })
})
