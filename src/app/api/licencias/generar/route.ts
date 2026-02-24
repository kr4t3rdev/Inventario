import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuthPost } from "@/lib/auth-middleware"

function generarClave(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const segmentos = 4
  const longitudSegmento = 5
  const claves: string[] = []

  for (let s = 0; s < segmentos; s++) {
    let segmento = ""
    for (let i = 0; i < longitudSegmento; i++) {
      segmento += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    claves.push(segmento)
  }

  return claves.join("-")
}

export const POST = withAuthPost(async (request: NextRequest, _context: unknown, user: any) => {
  if (user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const body = await request.json()
  const { planId, cantidad = 1, duracionDias } = body

  if (!planId) {
    return NextResponse.json({ error: "Plan requerido" }, { status: 400 })
  }

  const plan = await prisma.plan.findUnique({ where: { planId } })
  if (!plan) {
    return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 })
  }

  const dias = duracionDias || plan.duracionDias
  const licencias: { clave: string; expiracion: Date }[] = []

  for (let i = 0; i < cantidad; i++) {
    const clave = generarClave()
    const expiracion = new Date()
    expiracion.setDate(expiracion.getDate() + dias)

    const licencia = await prisma.licencia.create({
      data: {
        clave,
        planId,
        expiracion,
        activa: true,
        usuarioId: user.userId,
      },
      select: { clave: true, expiracion: true },
    })

    licencias.push(licencia)
  }

  return NextResponse.json({
    cantidad: licencias.length,
    plan: plan.nombre,
    dias,
    licencias,
  })
})
