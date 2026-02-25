import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuthPost, withAuthGet } from "@/lib/auth-middleware"

export const GET = withAuthGet(async (request: NextRequest, _context: unknown, user: any) => {
  if (user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

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
})

export const POST = withAuthPost(async (request: NextRequest, _context: unknown, user: any) => {
  if (user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const body = await request.json()
  const { clave, usuarioId, planId, duracionDias } = body

  if (!usuarioId || !planId) {
    return NextResponse.json(
      { error: "Usuario y plan son requeridos" },
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

  if (duracionDias !== undefined) {
    const n = Number(duracionDias)
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json({ error: "duracionDias debe ser un entero positivo" }, { status: 400 })
    }
  }

  const expiracion = new Date()
  expiracion.setDate(expiracion.getDate() + (duracionDias || plan.duracionDias))

  try {
    const licenseKey =
      typeof clave === "string" && clave.trim().length > 0
        ? clave.trim()
        : (() => {
            const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
            const seg = 4
            const len = 5
            const parts: string[] = []
            for (let s = 0; s < seg; s++) {
              let segmento = ""
              for (let i = 0; i < len; i++) {
                segmento += chars.charAt(Math.floor(Math.random() * chars.length))
              }
              parts.push(segmento)
            }
            return parts.join("-")
          })()

    const licencia = await prisma.$transaction(async (tx) => {
      const nuevaLicencia = await tx.licencia.create({
        data: {
          clave: licenseKey,
          usuarioId,
          planId,
          expiracion,
        },
        include: {
          usuario: { select: { userId: true, name: true, email: true } },
          plan: true,
        },
      })

      await tx.user.update({
        where: { userId: usuarioId },
        data: { expiresAt: expiracion },
      })

      // Auditoría
      await tx.licenciaAudit.create({
        data: {
          licenciaId: nuevaLicencia.licenciaId,
          accion: "CREACION",
          realizadoPor: user.userId,
          ip: request.headers.get("x-forwarded-for") || "unknown",
          userAgent: request.headers.get("user-agent") || "unknown",
          detalles: JSON.stringify({
            plan: plan.nombre,
            duracionDias: duracionDias || plan.duracionDias,
            expiracion: expiracion.toISOString()
          })
        }
      })

      return nuevaLicencia
    })

    return NextResponse.json(licencia, { status: 201 })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 'P2002') {
      return NextResponse.json(
        { error: "La clave de licencia ya existe" },
        { status: 409 }
      )
    }
    console.error("Error creando licencia:", error)
    return NextResponse.json(
      { error: "Error creando licencia" },
      { status: 500 }
    )
  }
})
